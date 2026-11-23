// A camera is a rectangle of the world (a View, in world units) and a canvas it is drawn onto.
// Everything here is pure: no DOM, no canvas state except in apply(), so it is unit tested.
// The trailer (promo/trailer.ts) shares the small maths helpers.

export type View = { x: number; y: number; w: number; h: number };
export type Rect = { left: number; top: number; width: number; height: number };

export const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (t: number): number => { t = clamp(t); return t * t * (3 - 2 * t); };
/** Frame-rate independent easing factor: how far to move toward the target this step. */
export const expK = (rate: number, dt: number): number => 1 - Math.exp(-rate * dt);

/**
 * The smallest view with the canvas's aspect ratio that contains `target` ('contain'), centred on
 * it. Uniform scale, so circles stay circles.
 */
export function fit(target: View, canvasW: number, canvasH: number, _mode: 'contain' = 'contain'): View {
  const aspect = canvasW / canvasH;
  let w = target.w, h = target.h;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  return { x: target.x + target.w / 2 - w / 2, y: target.y + target.h / 2 - h / 2, w, h };
}

/** Set the canvas transform so world `view` fills the canvas (device pixels). */
export function apply(ctx: CanvasRenderingContext2D, view: View, canvas: { width: number; height: number }): void {
  const sx = canvas.width / view.w, sy = canvas.height / view.h;
  ctx.setTransform(sx, 0, 0, sy, -view.x * sx, -view.y * sy);
}

/** Screen point (client px) → world units, the inverse of apply() for a canvas at `rect`. */
export function toWorld(view: View, rect: Rect, clientX: number, clientY: number): { x: number; y: number } {
  return { x: view.x + ((clientX - rect.left) / rect.width) * view.w, y: view.y + ((clientY - rect.top) / rect.height) * view.h };
}

/** CSS pixels per world unit for a view shown in a canvas box of this CSS width. */
export const cssScale = (view: View, cssW: number): number => cssW / view.w;

/**
 * Ease `current` toward `target`. The centre pans at `rate`; the size zooms at `zoomRate` in log
 * space, so a zoom in and the zoom back out feel the same. Both are exponential, so they do not
 * depend on the frame rate.
 */
export function ease(current: View, target: View, dt: number, rate: number, zoomRate = rate): View {
  const kp = expK(rate, dt), kz = expK(zoomRate, dt);
  const cx = lerp(current.x + current.w / 2, target.x + target.w / 2, kp);
  const cy = lerp(current.y + current.h / 2, target.y + target.h / 2, kp);
  const w = Math.exp(lerp(Math.log(current.w), Math.log(target.w), kz));
  const h = Math.exp(lerp(Math.log(current.h), Math.log(target.h), kz));
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * Slide `view` so it stays inside `extent`, without resizing it. On an axis where the view is
 * larger than the extent it is centred.
 */
export function clampTo(view: View, extent: View): View {
  const axis = (p: number, s: number, ep: number, es: number) => (s >= es ? ep + es / 2 - s / 2 : clamp(p, ep, ep + es - s));
  return { x: axis(view.x, view.w, extent.x, extent.w), y: axis(view.y, view.h, extent.y, extent.h), w: view.w, h: view.h };
}

/** A focus-and-zoom camera (the trailer's form) as a View of a `vw` × `vh` world. */
export function focusView(fx: number, fy: number, z: number, vw = 960, vh = 540): View {
  return { x: fx - vw / z / 2, y: fy - vh / z / 2, w: vw / z, h: vh / z };
}

/** Keep a focus camera inside the world: zooms in (z >= 1) never look past the edge. */
export function clampFocus(fx: number, fy: number, z: number, vw = 960, vh = 540): { fx: number; fy: number } {
  if (z < 1) return { fx: vw / 2, fy: vh / 2 };
  const hw = vw / 2 / z, hh = vh / 2 / z;
  return { fx: clamp(fx, hw, vw - hw), fy: clamp(fy, hh, vh - hh) };
}

export const sameView = (a: View, b: View): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
