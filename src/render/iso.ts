// Oblique projection for render-only depth. The game itself is a 2D side view: everything
// that touches the ball lives in the plane z = 0. Depth (z) is pushed up and to the right,
// so the court reads as a floor seen from slightly above and in front.

export const KX = 0.55;
export const KY = -0.32;

/** World point (x, y) at depth z → screen point in world units. */
export const proj = (x: number, y: number, z: number) => ({ x: x + z * KX, y: y + z * KY });

/** Depth range of the visible floor: a strip in front of the players and a stretch behind. */
export const Z_FRONT = -42;
export const Z_BACK = 270;

type P = { x: number; y: number };

/** Points of a circle lying flat (in the x–z plane) at height y, projected. */
export function flatCircle(cx: number, y: number, cz: number, r: number, from = 0, to = Math.PI * 2, n = 32): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = from + ((to - from) * i) / n;
    pts.push(proj(cx + Math.cos(t) * r, y, cz + Math.sin(t) * r));
  }
  return pts;
}

export function path(ctx: CanvasRenderingContext2D, pts: P[], close = false): void {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

/**
 * Pencil hatching inside the current path: parallel strokes at `angle` (radians), `gap` apart.
 * The caller builds the path first; this clips to it and restores.
 */
export function hatch(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; w: number; h: number }, gap: number, angle = -Math.PI / 4): void {
  ctx.save();
  ctx.clip();
  const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  const L = Math.hypot(bounds.w, bounds.h) / 2 + gap;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  ctx.beginPath();
  for (let s = -L; s <= L; s += gap) {
    const ox = cx - dy * s, oy = cy + dx * s;
    ctx.moveTo(ox - dx * L, oy - dy * L);
    ctx.lineTo(ox + dx * L, oy + dy * L);
  }
  ctx.stroke();
  ctx.restore();
}
