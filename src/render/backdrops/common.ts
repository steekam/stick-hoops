import { FLOOR } from '../../sim/constants';
import { path, proj, Z_BACK } from '../iso';
export { hatch, path, proj } from '../iso';
export type { Colors } from '../pen';
export { W, FLOOR } from '../../sim/constants';

// Shared helpers for backdrops. Each backdrop lives in its own file and draws in world units
// (960 × 540, y down). Everything above WALL_BASE is backdrop; the floor is drawn over the rest.

export type Ctx = CanvasRenderingContext2D;

/** Screen y of the floor's back edge: everything above it is backdrop. */
export const WALL_BASE = proj(0, FLOOR, Z_BACK).y;

/** A tiny seeded random, so backdrops are identical every frame and every session. */
export function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number) {
  path(ctx, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true);
}

/** Where the hanging scoreboard sits. Backdrops keep this area clear of their own detail. */
export const SCOREBOARD = { x: 405, y: 22, w: 170, h: 72 };
