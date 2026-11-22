import { simulateShot, makeLaunch, type Launch, type ShotResult } from '../sim/shot';
import type { World } from '../sim/world';
import type { Game } from './game';

/**
 * Hooks for the end-to-end tests, installed only with `?e2e` in the URL (or in dev).
 *
 * Tests never guess at drag gestures. They ask the simulation for a launch that scores (or
 * misses) from where the shooter stands right now, then fire it through the real Game.shoot.
 * Because the live loop and simulateShot share the same stepping code, a planned make must
 * score live; a test that sees otherwise has found a real divergence.
 */
export function installTestHooks(g: Game): void {
  const deg = Math.PI / 180;

  function find(want: (r: ShotResult) => boolean): { vx: number; vy: number; r: ShotResult } | null {
    for (let a = 40; a <= 78; a += 1) {
      for (let sp = 300; sp <= 1120; sp += 6) {
        const vx = Math.cos(-a * deg) * sp, vy = Math.sin(-a * deg) * sp;
        const r = simulateShot(g.world, makeLaunch(g.tick, g.player.x, vx, vy));
        if (want(r)) return { vx, vy, r };
      }
    }
    return null;
  }

  /** Run the game forward without waiting for frames until the shooter can shoot again. */
  function settle(): number {
    let n = 0;
    while ((g.ball || g.walking() || g.fig.kind === 'cheer' || g.fig.kind === 'slump' || g.fig.kind === 'throw') && n < 6000) {
      g.update(1 / 60);
      n++;
    }
    return n;
  }

  function fire(want: (r: ShotResult) => boolean, what: string): ShotResult {
    settle();
    if (!g.canShoot()) throw new Error(`cannot shoot now (${what})`);
    const f = find(want);
    if (!f) throw new Error(`no launch found for ${what} from x=${g.player.x.toFixed(1)}`);
    g.shoot(f.vx, f.vy);
    return f.r;
  }

  const hooks = {
    canShoot: () => g.canShoot(),
    /** Planned make. `kind`: any make, a swish, or a make that touches the rim or board. */
    shootMake: (kind: 'any' | 'swish' | 'dirty' = 'any') =>
      fire((r) => r.made && (kind === 'any' || (kind === 'swish' ? r.swish : !r.swish)), `${kind} make`),
    /** Planned miss that clanks off the rim (a rim-out). */
    shootRimOut: () => fire((r) => r.rimOut, 'rim-out'),
    /** A weak floater that lands far short. Always a miss. */
    shootMiss: (): void => { settle(); if (!g.canShoot()) throw new Error('cannot shoot now (miss)'); g.shoot(140, -160); },
    /** Fire an exact velocity (for drag-free checks of the real input path). */
    shoot: (vx: number, vy: number): void => g.shoot(vx, vy),
    settle,
    /** Advance game time by `sec` seconds in 1/60 s frames. */
    advance: (sec: number): void => { for (let t = 0; t < sec; t += 1 / 60) g.update(1 / 60); },
    simulate: (w: World, l: Launch) => simulateShot(w, l),
    state: () => ({
      mode: g.mode?.id ?? null,
      tick: g.tick,
      px: g.player.x,
      tag: g.player.tag,
      variant: g.player.variant,
      world: JSON.parse(JSON.stringify(g.world)) as World,
      ball: !!g.ball,
      fig: g.fig.kind,
      canShoot: g.canShoot(),
    }),
  };
  (window as unknown as { __test: typeof hooks }).__test = hooks;
}
