import { sfx } from '../../audio/sfx';
import { RIM_W } from '../../sim/constants';
import { between, sign } from '../../sim/rng';
import { scoreShot } from '../../sim/scoring';
import { defaultHoop } from '../../sim/world';
import type { Game } from '../../game/game';
import type { Mode, OverlayButton } from '../../game/types';
import { delay, dress, HANDOFF_DELAY, handoff, other, Side, TAGS } from './common';

// ---------- pure rules ----------

export const SHOTS_EACH = 5;
export const CHARGE_MAX = 2;

export type PowerKind = 'gust' | 'elevator' | 'tight';
export const POWER_NAMES: Record<PowerKind, string> = { gust: 'Gust', elevator: 'Elevator', tight: 'Tight rim' };

export interface Power {
  kind: PowerKind;
  /** Who armed it. It hits the other player's next shot. */
  by: Side;
  /** Gust only: the wind it blows, drawn from the seeded rng when armed. */
  wind?: number;
}

export interface SabState {
  first: Side;
  /** Shots taken so far, both players. */
  shots: number;
  scores: [number, number];
  streaks: [number, number];
  charge: [number, number];
  /** Armed, waiting for the target's next shot. */
  armed: Power | null;
  /** On for the shot being taken now. */
  active: Power | null;
  winner: Side | null;
}

export const sabInit = (first: Side = 0): SabState => ({
  first, shots: 0, scores: [0, 0], streaks: [0, 0], charge: [0, 0], armed: null, active: null, winner: null,
});

export const sabShooter = (s: SabState): Side => ((s.first + s.shots) % 2 === 0 ? 0 : 1) as Side;
/** 0-based round; both players shoot once per round from the same spot. */
export const sabRound = (s: SabState): number => Math.floor(s.shots / 2);
export const suddenDeath = (s: SabState): boolean => s.shots >= SHOTS_EACH * 2;
export const canArm = (s: SabState, p: Side): boolean => s.winner === null && s.charge[p] >= CHARGE_MAX && !s.armed;

export function arm(s: SabState, p: Side, kind: PowerKind, wind?: number): void {
  s.charge[p] = 0;
  s.armed = { kind, by: p, wind };
}

/** Start the current shooter's turn: an armed power-up against them switches on. */
export function sabBeginTurn(s: SabState): Power | null {
  const p = sabShooter(s);
  if (s.armed && s.armed.by !== p) { s.active = s.armed; s.armed = null; }
  else s.active = null;
  return s.active;
}

/** Record a finished shot worth `pts` (0 for a miss). Returns true when the match is decided. */
export function sabShot(s: SabState, made: boolean, pts: number): boolean {
  const p = sabShooter(s);
  if (made) {
    s.scores[p] += pts;
    s.streaks[p]++;
    s.charge[p] = Math.min(CHARGE_MAX, s.charge[p] + 1);
  } else s.streaks[p] = 0;
  s.active = null;
  s.shots++;
  // A match is only decided after both players have shot in a round.
  if (s.shots >= SHOTS_EACH * 2 && s.shots % 2 === 0 && s.scores[0] !== s.scores[1]) {
    s.winner = s.scores[0] > s.scores[1] ? 0 : 1;
    return true;
  }
  return false;
}

// ---------- the mode ----------

/** Sabotage: five shots each, alternating. Two makes charge a power-up against the other player. */
export function sabotage(first: Side = 0): Mode {
  let st = sabInit(first);
  let spot = 400;
  let spotRound = -1;
  let ready = false;
  const wait = delay();

  function clearEffects(g: Game): void {
    g.world.wind = 0;
    g.world.hoop = defaultHoop();
    g.world.rimW = RIM_W;
  }

  function applyEffect(g: Game, pw: Power): void {
    if (pw.kind === 'gust') g.world.wind = pw.wind ?? 160;
    if (pw.kind === 'elevator') { g.world.hoop.my = 60; g.world.hoop.sp = 1.4; }
    if (pw.kind === 'tight') g.world.rimW = 34;
  }

  function effectLine(pw: Power): string {
    if (pw.kind === 'gust') return `Gust: wind blowing ${(pw.wind ?? 0) < 0 ? 'in your face' : 'at your back'}.`;
    if (pw.kind === 'elevator') return 'Elevator: the hoop moves up and down.';
    return 'Tight rim: the hoop is narrower.';
  }

  function turnLabel(): string {
    if (suddenDeath(st)) return 'sudden death';
    return `shot ${sabRound(st) + 1} of ${SHOTS_EACH}`;
  }

  /** Handoff screen for whoever shoots next. */
  function beginTurn(g: Game, firstTurn = false): void {
    ready = false;
    clearEffects(g);
    const p = sabShooter(st);
    dress(g, p);
    if (sabRound(st) !== spotRound) { spotRound = sabRound(st); spot = Math.round(between(g.rng, 190, 580)); }
    g.placePlayer(spot, firstTurn);
    const pw = sabBeginTurn(st);
    if (pw) applyEffect(g, pw);
    const go = () => { ready = true; };
    const head = firstTurn ? `${TAGS[p]} shoots first` : `${TAGS[p]}'s turn`;
    let body = `${cap(turnLabel())}. ${TAGS[p]} ${st.scores[p]}, ${TAGS[other(p)]} ${st.scores[other(p)]}.`;
    if (suddenDeath(st) && st.shots % 2 === 0) body = `Tied at ${st.scores[0]}. One shot each, same spot.`;
    if (pw) body += ` ${TAGS[pw.by]} sabotaged this shot. ${effectLine(pw)}`;
    handoff(g, head, body, [{ label: 'Ready', action: go }]);
  }

  /** After a shot: the player who just shot may arm a power-up before passing the device. */
  function afterShot(g: Game, p: Side): void {
    if (!canArm(st, p)) { beginTurn(g); return; }
    const q = TAGS[other(p)];
    const pick = (kind: PowerKind) => () => {
      const wind = kind === 'gust' ? sign(g.rng) * 160 : undefined;
      arm(st, p, kind, wind);
      sfx.zap();
      g.pop(`${POWER_NAMES[kind].toUpperCase()} ARMED`);
      beginTurn(g);
    };
    const buttons: OverlayButton[] = [
      { label: 'Gust', action: pick('gust') },
      { label: 'Elevator', action: pick('elevator') },
      { label: 'Tight rim', action: pick('tight') },
      { label: 'Save it', secondary: true, action: () => beginTurn(g) },
    ];
    handoff(g, `${TAGS[p]}: power-up ready`, `Mess with ${q}'s next shot. Gust blows wind, Elevator moves the hoop, Tight rim shrinks it.`, buttons);
  }

  function finish(g: Game): void {
    const w = st.winner!, l = other(w);
    sfx.clear();
    clearEffects(g);
    handoff(g, `${TAGS[w]} wins`, `${st.scores[w]} to ${st.scores[l]}.`, [
      { label: 'Rematch', action: () => g.setMode(sabotage(l)) },
    ]);
  }

  return {
    id: 'sabotage',
    name: 'Sabotage',
    start(g) {
      st = sabInit(first);
      spotRound = -1;
      wait.cancel();
      beginTurn(g, true);
    },
    aimDots: () => 6,
    canShoot: () => ready && !wait.busy && st.winner === null,
    onLaunch() { ready = false; },
    onShotEnd(g, r) {
      const p = sabShooter(st);
      const s = scoreShot(r, { streak: st.streaks[p] });
      const done = sabShot(st, r.made, r.made ? s.total : 0);
      if (r.made) g.pop(`+${s.total}${s.multiplier > 1 ? ` ×${s.multiplier}` : ''}`);
      wait.after(HANDOFF_DELAY, () => (done ? finish(g) : afterShot(g, p)));
    },
    update(_g, dt) { wait.tick(dt); },
    stop(g) { wait.cancel(); clearEffects(g); },
    hud() {
      const p = sabShooter(st);
      return {
        left: st.winner !== null ? 'Sabotage · final' : `Sabotage · ${TAGS[p]} · ${turnLabel()}`,
        mid: `P1 ${st.scores[0]}   P2 ${st.scores[1]}`,
        right: st.winner !== null ? TAGS[st.winner] : TAGS[p],
        rightNote: st.winner !== null ? 'WINS' : st.active ? `TO SHOOT · ${POWER_NAMES[st.active.kind].toUpperCase()}` : 'TO SHOOT',
      };
    },
    draw(g, ctx) {
      // Power meters, top right, well above the backboard (its top sits near y 194).
      const c = g.renderer.pen.c;
      ctx.save();
      ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 2;
      const shooter = sabShooter(st);
      for (const p of [0, 1] as Side[]) {
        const y = 28 + p * 26, x = 760;
        const on = p === shooter && st.winner === null;
        ctx.fillStyle = on ? c.ink : c.mute;
        ctx.strokeStyle = on ? c.ink : c.mute;
        ctx.textAlign = 'left';
        ctx.fillText(TAGS[p], x, y);
        for (let k = 0; k < CHARGE_MAX; k++) {
          const bx = x + 32 + k * 22;
          ctx.strokeRect(bx, y - 7, 16, 14);
          if (st.charge[p] > k) ctx.fillRect(bx + 3, y - 4, 10, 8);
        }
        let note = '';
        if (st.armed?.by === p) note = `${POWER_NAMES[st.armed.kind].toUpperCase()} SET`;
        else if (st.charge[p] >= CHARGE_MAX) note = 'READY';
        if (note) ctx.fillText(note, x + 82, y);
      }
      if (st.active) {
        ctx.fillStyle = c.ink;
        ctx.textAlign = 'right';
        ctx.fillText(`${POWER_NAMES[st.active.kind].toUpperCase()} ON THIS SHOT`, 940, 92);
      }
      ctx.restore();
    },
  };
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
