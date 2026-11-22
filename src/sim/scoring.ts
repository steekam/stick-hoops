import { ShotResult } from './shot';

// Scoring lives in sim/ because the server must compute the same points from a replayed shot.
// PLACEHOLDER: Track C replaces this with the full scheme (distance scale, swish, tricks, streak ×).

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

export function scoreShot(r: ShotResult, _ctx: ScoreContext): Score {
  if (!r.made) return { base: 0, multiplier: 1, total: 0, parts: [] };
  const parts: ScorePart[] = [{ label: 'Bucket', pts: 2 }];
  if (r.swish) parts.push({ label: 'Swish', pts: 1 });
  const base = parts.reduce((s, p) => s + p.pts, 0);
  return { base, multiplier: 1, total: base, parts };
}
