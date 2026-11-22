import type { Game } from '../../game/game';
import type { OverlayButton } from '../../game/types';

// Shared bits for same-device duo modes: one figure on court, players pass the device.

export type Side = 0 | 1;
export const TAGS = ['P1', 'P2'] as const;
export const other = (p: Side): Side => (p === 0 ? 1 : 0);

/** Dress the one figure on court as this player: tag above the head, P2 gets a filled head. */
export function dress(g: Game, p: Side): void {
  g.player.tag = TAGS[p];
  g.player.variant = p;
}

/** Seconds to let a shot's result sink in before the next handoff screen. */
export const HANDOFF_DELAY = 0.7;

/**
 * A short wait driven by the mode's update(), so nothing outlives the mode (no setTimeout).
 * `busy` is true while waiting; tick() runs the callback once when time is up.
 */
export function delay() {
  let left = 0;
  let fn: (() => void) | null = null;
  return {
    get busy(): boolean { return fn !== null; },
    after(sec: number, f: () => void): void { left = sec; fn = f; },
    tick(dt: number): void {
      if (!fn) return;
      left -= dt;
      if (left <= 0) { const f = fn; fn = null; f(); }
    },
    cancel(): void { fn = null; },
  };
}

export function handoff(g: Game, title: string, body: string, buttons: OverlayButton[]): void {
  g.showOverlay(title, body, buttons);
}

/** "HO···" style letter display for HORSE. */
export const WORD = 'HORSE';
export const lettersOf = (n: number): string => WORD.slice(0, n) + '·'.repeat(WORD.length - n);
