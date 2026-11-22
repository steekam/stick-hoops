import { FLOOR } from '../sim/constants';
import { hatch, path, proj } from './iso';

// Basketball court markings, laid out like a real half court seen from the sideline.
//
// The game's plane (z = 0) is the court's long axis, through the rim. Along it (x) one foot is
// 22 world units, which puts the three-point line 522 units from the rim, right where 60 Seconds
// counts threes. Across the court (z) the scale is halved, so the far sideline fits on screen:
// circles on the floor become ellipses, which the projection foreshortens anyway.

const FT = 22;      // world units per foot along the court
const FTZ = 11;     // world units per foot across it

/** Rim centre at the default hoop position (hoop anchor 790, rim 50 wide). */
export const RIM_X = 815;
/** Baseline: between the backboard (848–855) and the stanchion (900), as on a real court. */
export const BASELINE_X = 885;
/** Far sideline, 25 ft from the court's centre axis. */
export const SIDELINE_Z = 25 * FTZ;

const LANE_HALF = 8 * FTZ;            // the paint is 16 ft wide
const FT_LINE_X = BASELINE_X - 19 * FT; // free-throw line 19 ft from the baseline
const FT_R = 6 * FT;                   // free-throw circle radius 6 ft
const RA_R = 4 * FT;                   // restricted-area arc 4 ft from the rim
const THREE_R = 23.75 * FT;           // three-point arc 23 ft 9 in from the rim
const CORNER_Z = 22 * FTZ;            // corner threes 22 ft from the axis

type P = { x: number; y: number };

/** Points of an ellipse lying on the floor: x radius rx, z radius rz, angles a0..a1. */
function floorEllipse(cx: number, cz: number, rx: number, rz: number, a0: number, a1: number, n = 40): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push(proj(cx + Math.cos(t) * rx, FLOOR, cz + Math.sin(t) * rz));
  }
  return pts;
}

const on = (x: number, z: number): P => proj(x, FLOOR, z);

/**
 * Draw the markings into a context already set to world units.
 * zFront is the nearest visible depth, so lines that run toward the viewer stop at the edge.
 */
export function drawCourtLines(ctx: CanvasRenderingContext2D, ink: string, mute: string, zFront: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The paint, shaded with light hatching like a pencil-filled area.
  const paint = [on(FT_LINE_X, -LANE_HALF), on(BASELINE_X, -LANE_HALF), on(BASELINE_X, LANE_HALF), on(FT_LINE_X, LANE_HALF)];
  ctx.strokeStyle = mute; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.35;
  path(ctx, paint, true);
  const xs = paint.map((p) => p.x), ys = paint.map((p) => p.y);
  hatch(ctx, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }, 6, -0.25);

  ctx.strokeStyle = ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.7;

  // Far sideline, and the baseline running from the near edge of view to it.
  path(ctx, [on(-400, SIDELINE_Z), on(BASELINE_X, SIDELINE_Z)]); ctx.stroke();
  path(ctx, [on(BASELINE_X, zFront), on(BASELINE_X, SIDELINE_Z)]); ctx.stroke();

  // Lane outline and free-throw line.
  path(ctx, paint, true); ctx.stroke();

  // Lane hash marks: the block, then spaces up the lane, on both sides.
  const marks = [7, 8, 11, 14];
  marks.forEach((ft, i) => {
    const mx = BASELINE_X - ft * FT, len = i === 1 ? 10 : 6;
    for (const side of [-1, 1]) {
      const z0 = side * LANE_HALF, z1 = side * (LANE_HALF + len);
      ctx.lineWidth = i === 1 ? 3 : 1.7;
      if (Math.min(z0, z1) >= zFront) { path(ctx, [on(mx, z0), on(mx, z1)]); ctx.stroke(); }
    }
  });
  ctx.lineWidth = 1.7;

  // Free-throw circle: solid on the court side, dashed inside the lane.
  path(ctx, floorEllipse(FT_LINE_X, 0, FT_R, FT_R / 2, Math.PI / 2, (3 * Math.PI) / 2)); ctx.stroke();
  ctx.setLineDash([6, 6]);
  path(ctx, floorEllipse(FT_LINE_X, 0, FT_R, FT_R / 2, -Math.PI / 2, Math.PI / 2)); ctx.stroke();
  ctx.setLineDash([]);

  // Restricted-area arc under the rim.
  path(ctx, floorEllipse(RIM_X, 0, RA_R, RA_R / 2, Math.PI / 2, (3 * Math.PI) / 2, 24)); ctx.stroke();

  // Three-point line: straight in the corners, then the arc round the rim. Only the parts on
  // the visible floor are drawn; the near corner is off the bottom of the screen.
  const rz = (THREE_R * FTZ) / FT;
  const cornerX = RIM_X - THREE_R * Math.sqrt(1 - (CORNER_Z / rz) ** 2);
  const a = Math.asin(CORNER_Z / rz);
  const arc = floorEllipse(RIM_X, 0, THREE_R, rz, Math.PI - a, Math.PI + a, 60);
  const visible = arc.filter((_, i) => {
    const t = Math.PI - a + ((2 * a) * i) / 60;
    return Math.sin(t) * rz >= zFront;
  });
  path(ctx, [on(BASELINE_X, CORNER_Z), on(cornerX, CORNER_Z), ...visible]); ctx.stroke();

  ctx.restore();
}
