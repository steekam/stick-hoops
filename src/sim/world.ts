import { DT, FLOOR, RIM_W } from './constants';
import { dsin } from './math';

/** Hoop resting position plus optional sway: x = bx + mx·sin(ph), y = by + my·sin(1.3·ph). */
export interface HoopSpec {
  bx: number;
  by: number;
  mx: number;
  my: number;
  /** Sway speed, radians per second. */
  sp: number;
}

export interface WallSpec {
  x: number;
  w: number;
  h: number;
}

/** Everything about the court that affects a shot. Plain data, so it can be sent to a server. */
export interface World {
  hoop: HoopSpec;
  wall: WallSpec | null;
  /** Horizontal acceleration, px/s². Negative blows toward the shooter. */
  wind: number;
  /** Rim width; RIM_W normally, smaller under the Sabotage "tight rim" power-up. */
  rimW: number;
}

export const defaultHoop = (): HoopSpec => ({ bx: 790, by: FLOOR - 210, mx: 0, my: 0, sp: 1 });

export const makeWorld = (p: Partial<World> = {}): World => ({
  hoop: p.hoop ?? defaultHoop(),
  wall: p.wall ?? null,
  wind: p.wind ?? 0,
  rimW: p.rimW ?? RIM_W,
});

export const hoopMoves = (h: HoopSpec): boolean => h.mx !== 0 || h.my !== 0;

/** Hoop anchor (back-rim end of the hoop's 50px span) at a given world tick. */
export function hoopAt(h: HoopSpec, tick: number): { x: number; y: number } {
  const ph = tick * DT * h.sp;
  return { x: h.bx + h.mx * dsin(ph), y: h.by + h.my * dsin(ph * 1.3) };
}

/** Collision geometry of the hoop at a tick. */
export function hoopGeom(w: World, tick: number) {
  const { x, y } = hoopAt(w.hoop, tick);
  return {
    x,
    y,
    front: { x: x + RIM_W - w.rimW, y },
    back: { x: x + RIM_W, y },
    boardX: x + 58,
    boardTop: y - 84,
    boardBottom: y + 14,
    poleX: x + 88,
  };
}
