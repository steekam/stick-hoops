// Per-device records. PLACEHOLDER: Track C fills this in (per-mode bests, totals, recording).
// The menu (Track A) reads these through readBests(); keep the shape stable.

export interface ModeBests {
  /** Highest score in a round (60 Seconds, Practice session). */
  score?: number;
  /** Longest run of makes. */
  streak?: number;
  /** Swishes in one round. */
  swishes?: number;
  /** Levels: highest level reached (1-based). */
  level?: number;
}

export interface Totals {
  shots: number;
  makes: number;
  swishes: number;
}

export function readBests(): Record<string, ModeBests> {
  return {};
}

export function readTotals(): Totals {
  return { shots: 0, makes: 0, swishes: 0 };
}
