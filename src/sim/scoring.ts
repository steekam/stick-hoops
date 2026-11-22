import { ShotResult } from './shot';

// Scoring lives in sim/ because the server must compute the same points from a replayed shot.
// Same determinism rules as the rest of sim/: only + - * /, Math.round/min/max.

export interface ScorePart {
  label: string;
  pts: number;
}

export interface Score {
  /** Points before the multiplier. */
  base: number;
  multiplier: number;
  total: number;
  parts: ScorePart[];
}

export interface ScoreContext {
  /** Consecutive makes before this shot. */
  streak: number;
}

/** Points for any make. */
export const BUCKET_PTS = 2;
/** Distance bonus: 0 at or inside DIST_MIN px, rising linearly to DIST_MAX_PTS at DIST_MAX px. */
export const DIST_MIN = 220;
export const DIST_MAX = 560;
export const DIST_MAX_PTS = 2;
export const SWISH_PTS = 1;
export const BANK_PTS = 1;
export const WALL_PTS = 2;
export const MOVING_PTS = 1;
/** Streak multipliers: `x` applies when this make is at least the `from`-th in a row. Highest first. */
export const STREAK_TIERS: readonly { from: number; x: number }[] = [
  { from: 10, x: 4 },
  { from: 6, x: 3 },
  { from: 3, x: 2 },
];

/** Whole bonus points for a shot from `distance` px (horizontal, shooter to front rim). */
export function distancePts(distance: number): number {
  if (distance <= DIST_MIN) return 0;
  if (distance >= DIST_MAX) return DIST_MAX_PTS;
  return Math.round(((distance - DIST_MIN) * DIST_MAX_PTS) / (DIST_MAX - DIST_MIN));
}

/** Multiplier for a make that is the `nth` in a row (1 = first make). */
export function streakMultiplier(nth: number): number {
  for (const t of STREAK_TIERS) if (nth >= t.from) return t.x;
  return 1;
}

export function scoreShot(r: ShotResult, ctx: ScoreContext): Score {
  if (!r.made) return { base: 0, multiplier: 1, total: 0, parts: [] };
  const parts: ScorePart[] = [{ label: 'Bucket', pts: BUCKET_PTS }];
  const d = distancePts(r.distance);
  if (d > 0) parts.push({ label: 'Distance', pts: d });
  if (r.swish) parts.push({ label: 'Swish', pts: SWISH_PTS });
  if (r.bank) parts.push({ label: 'Bank shot', pts: BANK_PTS });
  if (r.offWall) parts.push({ label: 'Off the wall', pts: WALL_PTS });
  if (r.movingHoop) parts.push({ label: 'Moving hoop', pts: MOVING_PTS });
  const base = parts.reduce((s, p) => s + p.pts, 0);
  const multiplier = streakMultiplier(Math.max(0, ctx.streak) + 1);
  return { base, multiplier, total: base * multiplier, parts };
}

/**
 * The headline reason for a make, for floating text: the biggest trick, else "SWISH", else
 * "DEEP" for a distance bonus, else ''. Uppercase, short.
 */
export function mainReason(s: Score): string {
  const order: [string, string][] = [
    ['Off the wall', 'OFF THE WALL'],
    ['Bank shot', 'BANK'],
    ['Swish', 'SWISH'],
    ['Moving hoop', 'MOVER'],
    ['Distance', 'DEEP'],
  ];
  for (const [label, text] of order) if (s.parts.some((p) => p.label === label)) return text;
  return '';
}

/** "+6 SWISH ×2" style label for a make. */
export function popLabel(s: Score): string {
  const reason = mainReason(s);
  return `+${s.total}${reason ? ' ' + reason : ''}${s.multiplier > 1 ? ' ×' + s.multiplier : ''}`;
}
