import type { Game } from './game';
import type { ShotResult } from '../sim/shot';

/** What the scoreboard strip above the court shows. Plain strings; the UI escapes them. */
export interface Hud {
  left: string;
  mid: string;
  right: string;
  /** Small caption after `right`, e.g. "PTS · BEST 30". */
  rightNote?: string;
}

/**
 * A game mode. The Game owns the court, the shooter and the ball; a mode owns the rules.
 *
 * Lifecycle: start() once when chosen → per shot: canShoot() gates input, onLaunch() when the
 * ball leaves the hands, onScore() the moment it drops through, onShotEnd() when it has settled.
 * Use g.showOverlay() for end-of-round screens and g.pop() for floating text.
 */
export interface Mode {
  id: string;
  name: string;
  start(g: Game): void;
  /** How many dots of the aiming guide to show (0 = none). */
  aimDots(g: Game): number;
  canShoot?(g: Game): boolean;
  onLaunch?(g: Game): void;
  onScore?(g: Game, swish: boolean): void;
  onShotEnd(g: Game, r: ShotResult): void;
  update?(g: Game, dt: number): void;
  hud(g: Game): Hud;
  /** Extra court drawing in world units, drawn after the court and before the overlay. */
  draw?(g: Game, ctx: CanvasRenderingContext2D): void;
  /** Called when leaving the mode (back to menu). */
  stop?(g: Game): void;
}

export type FigKind = 'idle' | 'throw' | 'cheer' | 'slump';

export interface FigState {
  kind: FigKind;
  t: number;
  /** Variant: cheer arms|dab|guns|moon|flip, slump slump|palm|kick. */
  v?: string;
  dir: { x: number; y: number };
}

export interface OverlayButton {
  label: string;
  action: () => void;
  /** Secondary buttons render as outlines. Default primary. */
  secondary?: boolean;
}

/** Extras for an end-of-round card: a Menu button is always added; Share when `share` is set. */
export interface RoundEnd {
  /** One line to share, e.g. "I scored 23 in 60 Seconds on Stick Hoops." */
  share?: string;
  /** A personal best was beaten: confetti and a fanfare. */
  best?: boolean;
}
