import { sfx } from '../../audio/sfx';
import { FLOOR } from '../../sim/constants';
import { between } from '../../sim/rng';
import { store } from '../../storage';
import { recordRound, recordShot } from '../../stats';
import type { Game } from '../../game/game';
import type { Mode } from '../../game/types';

export interface LevelDef {
  name: string;
  px: number;
  balls: number;
  need: number;
  hy?: number;
  wall?: { x: number; h: number };
  mx?: number;
  my?: number;
  sp?: number;
  wind?: number;
  /** Random wind of up to ± this much, redrawn every shot. */
  gust?: number;
}

export const LEVELS: LevelDef[] = [
  { name: 'Warm up', px: 540, balls: 5, need: 2 },
  { name: 'Step back', px: 400, balls: 5, need: 2 },
  { name: 'Downtown', px: 220, balls: 6, need: 2 },
  { name: 'The wall', px: 420, balls: 6, need: 2, hy: FLOOR - 250, wall: { x: 600, h: 190 } },
  { name: 'Elevator', px: 420, balls: 6, need: 2, my: 70, sp: 1.3 },
  { name: 'Headwind', px: 380, balls: 6, need: 2, wind: -170 },
  { name: 'Tailwind', px: 250, balls: 6, need: 2, wind: 190 },
  { name: 'Shuffle', px: 360, balls: 7, need: 3, mx: 60, sp: 1.1, wall: { x: 610, h: 150 } },
  { name: 'Gusts', px: 200, balls: 7, need: 3, gust: 160 },
  { name: 'Final', px: 260, balls: 8, need: 3, mx: 35, my: 50, sp: 1.4, wall: { x: 600, h: 200 }, wind: -110 },
];

export const unlockedLevel = (): number => store.get('unlocked', 0);

/** `onLevelChange` lets the UI keep its level picker in sync. */
export type LevelsMode = Mode & { load(g: Game, i: number): void };

export function levels(startAt = unlockedLevel(), onLevelChange?: (i: number) => void): LevelsMode {
  let level = 0, made = 0, left = 0;

  function load(g: Game, i: number): void {
    const L = LEVELS[i];
    level = i; made = 0; left = L.balls;
    g.reset();
    g.world.hoop = { bx: 790, by: L.hy ?? FLOOR - 210, mx: L.mx ?? 0, my: L.my ?? 0, sp: L.sp ?? 1 };
    g.world.wall = L.wall ? { x: L.wall.x, w: 16, h: L.wall.h } : null;
    g.world.wind = L.wind ?? (L.gust ? between(g.rng, -L.gust, L.gust) : 0);
    g.placePlayer(L.px, true);
    recordRound('levels', { level: i + 1 });
    onLevelChange?.(i);
    g.refreshHud(true);
  }

  const mode: LevelsMode = {
    id: 'levels',
    name: 'Levels',
    load,
    start(g) { load(g, Math.min(startAt, LEVELS.length - 1)); },
    aimDots: () => (level < 3 ? 20 : 8),
    onLaunch() { left--; },
    onShotEnd(g, r) {
      recordShot('levels', r);
      const L = LEVELS[level];
      if (r.made) made++;
      if (L.gust) g.world.wind = between(g.rng, -L.gust, L.gust);
      if (made >= L.need) {
        const n = level + 1;
        if (n > unlockedLevel() && n < LEVELS.length) store.set('unlocked', n);
        recordRound('levels', { level: Math.min(n + 1, LEVELS.length) });
        const used = L.balls - left;
        sfx.clear();
        if (n >= LEVELS.length) {
          store.set('allLevels', true);
          g.showOverlay('All ten cleared', `Final level done in ${used} shots. That's the whole ladder.`, [{ label: 'Play level 1', action: () => load(g, 0) }]);
        } else {
          g.showOverlay(`Level ${n} cleared`, `${made} of ${L.need} in ${used} shot${used > 1 ? 's' : ''}. Next: ${LEVELS[n].name}.`, [{ label: `Level ${n + 1}`, action: () => load(g, n) }]);
        }
        onLevelChange?.(level);
      } else if (left <= 0) {
        sfx.fail();
        g.showOverlay('Out of balls', `You made ${made} of the ${L.need} needed on ${L.name}.`, [{ label: 'Retry', action: () => load(g, level) }]);
      }
    },
    hud() {
      const L = LEVELS[level];
      return { left: `Level ${level + 1}/10 · ${L.name}`, mid: '●'.repeat(left) + '○'.repeat(L.balls - left), right: `${made}/${L.need}`, rightNote: 'MADE' };
    },
  };
  return mode;
}
