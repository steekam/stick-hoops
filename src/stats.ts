// Per-device records: per-mode bests and lifetime totals.
// The menu (Track A) reads these through readBests() / readTotals(); keep the shape stable.
import type { ShotResult } from './sim/shot';
import { store } from './storage';

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

export type BestKey = keyof ModeBests;
export type RoundStats = Partial<Record<BestKey, number>>;

const BESTS_KEY = 'bests';
const TOTALS_KEY = 'totals';
const MIGRATED_KEY = 'statsMigrated';

const zeroTotals = (): Totals => ({ shots: 0, makes: 0, swishes: 0 });

/** One-time copy of the pre-stats keys ('bestTime', 'bestStreak', 'unlocked') into bests. */
function migrate(): void {
  if (store.get(MIGRATED_KEY, false)) return;
  const bests = store.get<Record<string, ModeBests>>(BESTS_KEY, {});
  const up = (id: string, k: BestKey, v: number) => {
    if (!(v > 0)) return;
    const m = (bests[id] ??= {});
    if (!((m[k] ?? 0) >= v)) m[k] = v;
  };
  up('time', 'score', store.get('bestTime', 0));
  up('streak', 'streak', store.get('bestStreak', 0));
  // 'unlocked' is the 0-based index of the furthest unlocked level, so it was reached.
  const unlocked = store.get('unlocked', 0);
  up('levels', 'level', store.get('allLevels', false) ? 10 : unlocked > 0 ? unlocked + 1 : 0);
  store.set(BESTS_KEY, bests);
  store.set(MIGRATED_KEY, true);
}

export function readBests(): Record<string, ModeBests> {
  migrate();
  const b = store.get<Record<string, ModeBests>>(BESTS_KEY, {});
  return b && typeof b === 'object' ? b : {};
}

export function readTotals(): Totals {
  const t = store.get<Partial<Totals>>(TOTALS_KEY, {});
  return { ...zeroTotals(), ...(t && typeof t === 'object' ? t : {}) };
}

/** Bests for one mode (empty object if none yet). */
export const bestsFor = (modeId: string): ModeBests => readBests()[modeId] ?? {};

/** Count a finished shot in the lifetime totals. */
export function recordShot(_modeId: string, r: ShotResult): Totals {
  const t = readTotals();
  t.shots++;
  if (r.made) t.makes++;
  if (r.swish) t.swishes++;
  store.set(TOTALS_KEY, t);
  return t;
}

/**
 * Record the end of a round (or a running best, e.g. a streak as it grows). Returns the
 * records that were beaten, so the mode can say "New best". Zero never counts as a record.
 */
export function recordRound(modeId: string, s: RoundStats): BestKey[] {
  const bests = readBests();
  const m: ModeBests = { ...(bests[modeId] ?? {}) };
  const beaten: BestKey[] = [];
  for (const k of ['score', 'streak', 'swishes', 'level'] as BestKey[]) {
    const v = s[k];
    if (v == null || !(v > 0)) continue;
    if (v > (m[k] ?? 0)) {
      m[k] = v;
      beaten.push(k);
    }
  }
  if (beaten.length) {
    bests[modeId] = m;
    store.set(BESTS_KEY, bests);
  }
  return beaten;
}

const NAMES: Record<BestKey, string> = { score: 'score', streak: 'streak', swishes: 'swishes', level: 'level' };

/** " New best score and streak." or '' — ready to append to an overlay body. */
export function newBestText(beaten: BestKey[]): string {
  if (!beaten.length) return '';
  const names = beaten.map((k) => NAMES[k]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return ` New best ${list}.`;
}
