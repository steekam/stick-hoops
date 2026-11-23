import { FLOOR, H, RIM_W, W } from '../sim/constants';
import { hoopGeom } from '../sim/world';
import type { Game } from '../game/game';
import { clampTo, ease, fit, lerp, smooth, type View } from './camera';
import { proj, Z_FRONT } from './iso';

// A director decides, every frame, which part of the world the camera shows. The renderer draws
// whatever view it is given. Two directors:
//
//   fixed   the whole 960 x 540 court, stretched to the canvas. Exactly what the game always did.
//   follow  upright phones. The court is a strip across the upper part of a tall screen; the rest
//           is the thumb pad. While the ball is in flight the camera follows it and closes in on
//           the rim (no slow motion), holds on the result, then eases back.

export const FULL: View = { x: 0, y: 0, w: W, h: H };
/** How much of the world the follow camera's static layer covers: backdrops draw this far out. */
export const EXTENT: View = { x: -80, y: -420, w: 1120, h: 1020 };
/** Zoom while the ball is at the rim, relative to the aim framing (capped by MAX_CSS_SCALE). */
export const MAX_ZOOM = 2.5;
/** Never magnify beyond this many CSS px per world unit: the cached court is that sharp. */
export const MAX_CSS_SCALE = 1.7;
/** Where the floor's front edge sits on the canvas while aiming; below it is the thumb pad. */
export const FLOOR_AT = 0.52; // floor front edge this far down the canvas while aiming; the thumb pad gets the rest
const FLOOR_FRONT = proj(0, FLOOR, Z_FRONT).y + 10; // bottom of the stage-like front edge
/** How long the camera stays on the result before easing back. */
const HOLD = 0.9;

export interface Director {
  readonly kind: 'fixed' | 'follow';
  /** The view to draw this frame. */
  view: View;
  update(g: Game, dt: number, cssW: number, cssH: number): void;
  /** Jump to the right framing with no easing (new mode, new size). */
  snap(): void;
}

export function fixedDirector(): Director {
  return { kind: 'fixed', view: FULL, update() {}, snap() {} };
}

/** Upright phone: portrait and narrow. Landscape and desktop never match. */
const mql = typeof matchMedia === 'function' ? matchMedia('(orientation: portrait) and (max-width: 700px)') : null;
export const followWanted = (): boolean => !!mql?.matches;
export function onFollowChange(fn: () => void): void { mql?.addEventListener('change', fn); }

/** The framing while aiming: shooter, hoop, pole, wall and the hoop's whole range, floor at FLOOR_AT. */
export function aimView(g: Game, cssW: number, cssH: number): View {
  const hp = g.world.hoop, wall = g.world.wall;
  let left = g.player.x - 80, right = hp.bx + Math.abs(hp.mx) + 150;
  if (wall) { left = Math.min(left, wall.x - 20); right = Math.max(right, wall.x + wall.w + 10); }
  const top = hp.by - Math.abs(hp.my) - 84 - 40;
  const s = Math.min(cssW / (right - left), (FLOOR_AT * cssH) / (FLOOR_FRONT - top));
  const w = cssW / s, h = cssH / s;
  return { x: (left + right) / 2 - w / 2, y: Math.max(EXTENT.y, FLOOR_FRONT - FLOOR_AT * h), w, h };
}

export function followDirector(): Director {
  let cur: View | null = null;
  let size = '';
  let lastTick = Infinity;
  let hold = 0;
  let held: View | null = null;
  let hadBall = false;
  let lastTarget: View | null = null;
  // The extent plus all the paper below it: the camera may look down into the pad, never above the sky.
  const LIMIT: View = { x: EXTENT.x, y: EXTENT.y, w: EXTENT.w, h: 4000 };

  const d: Director = {
    kind: 'follow',
    view: FULL,
    update(g, dt, cssW, cssH) {
      if (cssW < 2 || cssH < 2) return;
      const key = `${Math.round(cssW)}x${Math.round(cssH)}`;
      if (key !== size || g.tick < lastTick) { size = key; cur = null; hold = 0; held = null; }
      lastTick = g.tick;
      const aim = aimView(g, cssW, cssH);
      let target = aim, pan = 4, zoom = 3;
      const ball = g.ball;
      if (ball) {
        const h = hoopGeom(g.world, g.tick), rx = h.x + RIM_W / 2, ry = h.y;
        // Zoom is distance based: wide while the ball climbs, closing in as it nears the rim.
        const near = 1 - smooth((Math.hypot(ball.x - rx, ball.y - ry) - 60) / 360);
        const s0 = cssW / aim.w;
        const z = lerp(1, Math.max(1, Math.min(MAX_ZOOM, MAX_CSS_SCALE / s0)), near);
        const aimCx = aim.x + aim.w / 2, aimCy = aim.y + aim.h / 2;
        const k = 0.25 + 0.6 * near; // how much the ball, rather than the aim framing, steers
        // Lead the ball a little so the easing lag does not let a fast ball outrun the frame.
        const bx = ball.x + ball.vx * 0.12, by = ball.y + ball.vy * 0.12;
        const fx = lerp(aimCx, lerp(bx, rx, 0.5 * near), k), fy = lerp(aimCy, lerp(by, ry, 0.3 * near), k);
        const w = aim.w / z, hh = aim.h / z;
        target = { x: fx - w / 2, y: fy - hh * (0.5 - 0.08 * near), w, h: hh };
        pan = 5 + 5 * near; zoom = 3 + 2.5 * near;
        lastTarget = target;
        hold = 0;
      } else if (hadBall && lastTarget) {
        hold = HOLD; held = lastTarget;
      }
      hadBall = !!ball;
      if (!ball && hold > 0 && held) { hold -= dt; target = held; pan = 3; zoom = 2.5; }
      else if (!ball) { pan = 3; zoom = 2.5; }
      cur = cur ? ease(cur, target, dt, pan, zoom) : { ...target };
      d.view = clampTo(fit(cur, cssW, cssH), LIMIT);
    },
    snap() { cur = null; size = ''; },
  };
  return d;
}
