import { DT, FLOOR, G, R, TICKS_PER_SEC, VMAX, W } from './constants';
import { clamp, len, quantize } from './math';
import { hoopGeom, hoopMoves, World } from './world';

/** What a player did: everything needed to replay the shot. */
export interface Launch {
  /** World tick at release. The hoop's sway depends on it. */
  tick: number;
  /** Shooter's x position (feet). */
  px: number;
  vx: number;
  vy: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ticks: number;
  touchedRim: boolean;
  touchedBoard: boolean;
  touchedWall: boolean;
  /** Board or wall touched before the ball dropped through (for bank / wall tricks). */
  boardBeforeScore: boolean;
  wallBeforeScore: boolean;
  scored: boolean;
  scoredAtTick: number;
  bounces: number;
  // Render-only, but cheap to keep here:
  rot: number;
  sq: number;
}

export type ShotEvent =
  | { type: 'rim' | 'board' | 'wall' | 'pole' | 'floor'; impact: number; x: number; y: number }
  | { type: 'score'; swish: boolean; x: number; y: number };

export interface ShotResult {
  made: boolean;
  swish: boolean;
  bank: boolean;
  offWall: boolean;
  movingHoop: boolean;
  rimOut: boolean;
  /** Horizontal distance from shooter to the rim's front at release. */
  distance: number;
  launch: Launch;
  ticks: number;
}

/** Power 0..1 from a launch velocity. */
export const power = (vx: number, vy: number): number => Math.min(len(vx, vy) / VMAX, 1);

/** Where the ball leaves the hands. Depends on power because the figure crouches as it loads. */
export const releasePoint = (px: number, pw: number) => ({ x: px + 4 - 12 * pw, y: FLOOR - 146 + 18 * pw });

/** Clamp and quantize a raw aim vector into a replayable launch. */
export function makeLaunch(tick: number, px: number, vx: number, vy: number): Launch {
  const m = len(vx, vy);
  if (m > VMAX) {
    vx = (vx / m) * VMAX;
    vy = (vy / m) * VMAX;
  }
  return { tick, px: quantize(px), vx: quantize(vx), vy: quantize(vy) };
}

export function launchBall(l: Launch): Ball {
  const p = releasePoint(l.px, power(l.vx, l.vy));
  return {
    x: p.x, y: p.y, vx: l.vx, vy: l.vy, ticks: 0,
    touchedRim: false, touchedBoard: false, touchedWall: false,
    boardBeforeScore: false, wallBeforeScore: false,
    scored: false, scoredAtTick: 0, bounces: 0, rot: 0, sq: 0,
  };
}

/** Push the ball out of a round obstacle and reflect it. Returns impact speed, or 0 if no contact. */
function collide(b: Ball, px: number, py: number, rad: number, rest: number): number {
  const dx = b.x - px, dy = b.y - py, d = len(dx, dy);
  if (d >= R + rad || d === 0) return 0;
  const nx = dx / d, ny = dy / d;
  b.x = px + nx * (R + rad);
  b.y = py + ny * (R + rad);
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + rest) * vn * nx;
    b.vy -= (1 + rest) * vn * ny;
    b.vx *= 0.96;
    b.vy *= 0.96;
  }
  return Math.max(0.001, -vn);
}

/**
 * Advance one fixed tick. `tick` is the world tick (for the hoop's sway).
 * Events go into `events` for sound and animation; the simulation never reads them back.
 */
export function stepBall(w: World, b: Ball, tick: number, events: ShotEvent[] | null): void {
  const py = b.y;
  b.vx += w.wind * DT;
  b.vy += G * DT;
  b.x += b.vx * DT;
  b.y += b.vy * DT;
  b.ticks++;
  b.rot += (b.vx * DT) / R;

  const h = hoopGeom(w, tick);
  for (const p of [h.front, h.back]) {
    const im = collide(b, p.x, p.y, 2.5, 0.55);
    if (im) {
      b.touchedRim = true;
      b.sq = Math.max(b.sq, 0.18);
      if (im > 60 && events) events.push({ type: 'rim', impact: im, x: b.x, y: b.y });
    }
  }
  {
    const im = collide(b, h.boardX, clamp(b.y, h.boardTop, h.boardBottom), 2, 0.6);
    if (im) {
      b.touchedBoard = true;
      if (!b.scored) b.boardBeforeScore = true;
      b.sq = Math.max(b.sq, 0.18);
      if (im > 60 && events) events.push({ type: 'board', impact: im, x: b.x, y: b.y });
    }
  }
  if (w.wall) {
    const wl = w.wall;
    const im = collide(b, clamp(b.x, wl.x, wl.x + wl.w), clamp(b.y, FLOOR - wl.h, FLOOR), 0, 0.5);
    if (im) {
      b.touchedWall = true;
      if (!b.scored) b.wallBeforeScore = true;
      if (im > 60 && events) events.push({ type: 'wall', impact: im, x: b.x, y: b.y });
    }
  }
  {
    const im = collide(b, h.poleX, clamp(b.y, h.y - 50, FLOOR), 3, 0.5);
    if (im > 60 && events) events.push({ type: 'pole', impact: im, x: b.x, y: b.y });
  }
  if (b.y > FLOOR - R) {
    b.y = FLOOR - R;
    if (b.vy > 0) {
      if (b.vy > 50 && events) events.push({ type: 'floor', impact: b.vy, x: b.x, y: b.y });
      b.sq = Math.min(0.45, b.vy / 1500);
      b.vy *= -0.6;
      b.vx *= 0.84;
      if (b.vy > -40) b.vy = 0;
      b.bounces++;
    }
  }
  if (!b.scored && py < h.y && b.y >= h.y && b.vy > 0 && b.x > h.front.x + 3 && b.x < h.back.x - 3) {
    b.scored = true;
    b.scoredAtTick = b.ticks;
    if (events) events.push({ type: 'score', swish: !b.touchedRim && !b.touchedBoard, x: b.x, y: b.y });
  }
}

/** Has this shot finished? Made shots linger a second so the net and celebration can play. */
export function shotOver(b: Ball): boolean {
  if (b.scored) return b.ticks - b.scoredAtTick > TICKS_PER_SEC;
  return (
    b.bounces >= 3 || b.x > W + 60 || b.x < -60 || b.ticks > 7 * TICKS_PER_SEC ||
    (b.y >= FLOOR - R - 0.5 && b.vy === 0 && Math.abs(b.vx) < 30)
  );
}

export function summarize(w: World, l: Launch, b: Ball): ShotResult {
  const h = hoopGeom(w, l.tick);
  return {
    made: b.scored,
    swish: b.scored && !b.touchedRim && !b.touchedBoard,
    bank: b.scored && b.boardBeforeScore,
    offWall: b.scored && b.wallBeforeScore,
    movingHoop: b.scored && hoopMoves(w.hoop),
    rimOut: !b.scored && b.touchedRim,
    distance: Math.round(h.front.x - l.px),
    launch: l,
    ticks: b.ticks,
  };
}

/** Run a whole shot with no rendering. This is what the server uses to verify a score. */
export function simulateShot(w: World, l: Launch): ShotResult {
  const b = launchBall(l);
  let tick = l.tick;
  while (!shotOver(b)) stepBall(w, b, ++tick, null);
  return summarize(w, l, b);
}
