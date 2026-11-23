import { sfx } from '../../audio/sfx';
import { between, sign } from '../../sim/rng';
import type { Game } from '../../game/game';
import type { Mode, OverlayButton } from '../../game/types';
import { FLOOR } from '../../sim/constants';
import { delay, dress, HANDOFF_DELAY, handoff, lettersOf, other, Side, TAGS, WORD } from './common';

// ---------- pure rules (no Game, so they can be tested and replayed) ----------

export interface HorseState {
  setter: Side;
  /** 'set': the setter shoots from a new spot. 'match': the other player copies a made shot. */
  phase: 'set' | 'match';
  letters: [number, number];
  /** Loser once someone spells HORSE, else null. */
  loser: Side | null;
}

export type HorseEvent = 'set-made' | 'set-miss' | 'match-made' | 'match-miss' | 'over';

export const horseInit = (first: Side = 0): HorseState => ({ setter: first, phase: 'set', letters: [0, 0], loser: null });

export const horseShooter = (s: HorseState): Side => (s.phase === 'set' ? s.setter : other(s.setter));

/** Apply one shot. Mutates `s` and says what happened. */
export function horseShot(s: HorseState, made: boolean): HorseEvent {
  if (s.loser !== null) return 'over';
  if (s.phase === 'set') {
    if (made) { s.phase = 'match'; return 'set-made'; }
    s.setter = other(s.setter); // a missed set passes control
    return 'set-miss';
  }
  const m = other(s.setter);
  s.phase = 'set'; // either way the setter sets again from a new spot
  if (made) return 'match-made';
  s.letters[m]++;
  if (s.letters[m] >= WORD.length) { s.loser = m; return 'over'; }
  return 'match-miss';
}

// ---------- the mode ----------

/** HORSE for two on one device. The setter's spot and wind carry over to the match shot. */
export function horse(first: Side = 0): Mode {
  let st = horseInit(first);
  let spot = 400;
  let wind = 0;
  let newSpotUsed = false;
  let ready = false;
  const wait = delay();

  /** A fresh spot. When rerolling, it is always clearly somewhere else (60+ px away). */
  function rollSpot(g: Game, awayFrom?: number): void {
    for (let i = 0; i < 20; i++) {
      spot = Math.round(between(g.rng, 190, 580));
      if (awayFrom == null || Math.abs(spot - awayFrom) >= 60) return;
    }
  }

  function setterScreen(g: Game, first: boolean): void {
    const p = TAGS[st.setter], q = TAGS[other(st.setter)];
    const title = first ? `${p} sets first` : `${p} sets`;
    const body = newSpotUsed
      ? `New spot. Make it and ${q} has to match it from here.`
      : `Shoot from here, or roll one new spot. Make it and ${q} has to match it.`;
    const buttons: OverlayButton[] = [{ label: 'Shoot from here', action: () => { ready = true; } }];
    if (!newSpotUsed) {
      buttons.push({
        label: 'New spot',
        secondary: true,
        action: () => {
          newSpotUsed = true;
          rollSpot(g, spot);
          g.placePlayer(spot);
          setterScreen(g, first);
        },
      });
    }
    handoff(g, title, body, buttons);
  }

  function beginTurn(g: Game, firstTurn = false): void {
    ready = false;
    const p = horseShooter(st);
    dress(g, p);
    if (st.phase === 'set') {
      newSpotUsed = false;
      rollSpot(g);
      wind = g.rng() < 0.5 ? 0 : Math.round(sign(g.rng) * between(g.rng, 40, 140));
      g.world.wind = wind;
      g.placePlayer(spot, firstTurn);
      setterScreen(g, firstTurn);
    } else {
      g.world.wind = wind;
      g.placePlayer(spot);
      const s = TAGS[st.setter], m = TAGS[p];
      const next = WORD[st.letters[p]];
      handoff(g, `${m} to match`, `${s} made it from this spot. Miss and you take an ${next}.`, [
        { label: 'Ready', action: () => { ready = true; } },
      ]);
    }
  }

  function finish(g: Game): void {
    const l = st.loser!, w = other(l);
    sfx.fail();
    handoff(g, `${TAGS[w]} wins`, `${TAGS[l]} spelled HORSE. ${TAGS[w]} had ${st.letters[w] ? WORD.slice(0, st.letters[w]) : 'no letters'}.`, [
      { label: 'Rematch', action: () => g.setMode(horse(l)) },
    ], { share: `${TAGS[w]} won a game of HORSE on Stick Hoops.` });
  }

  return {
    id: 'horse',
    name: 'HORSE',
    start(g) {
      st = horseInit(first);
      wait.cancel();
      beginTurn(g, true);
    },
    aimDots: () => 6,
    canShoot: () => ready && !wait.busy && st.loser === null,
    onLaunch() { ready = false; },
    onShotEnd(g, r) {
      const shooter = horseShooter(st);
      const ev = horseShot(st, r.made);
      if (ev === 'match-miss' || ev === 'over') {
        g.pop(WORD[st.letters[shooter] - 1], g.player.x, FLOOR - 190);
        sfx.fail();
      } else if (ev === 'set-made') g.pop('MATCH IT');
      else if (ev === 'match-made') g.pop('MATCHED');
      wait.after(HANDOFF_DELAY, () => (ev === 'over' ? finish(g) : beginTurn(g)));
    },
    update(_g, dt) { wait.tick(dt); },
    stop() { wait.cancel(); },
    hud(g) {
      const p = horseShooter(st);
      const what = st.loser !== null ? 'game over' : st.phase === 'set' ? `${TAGS[p]} sets` : `${TAGS[p]} to match`;
      return {
        left: `HORSE · ${what}`,
        mid: `P1 ${lettersOf(st.letters[0])}   P2 ${lettersOf(st.letters[1])}`,
        right: st.loser !== null ? TAGS[other(st.loser)] : TAGS[p],
        rightNote: st.loser !== null ? 'WINS' : g.world.wind ? `TO SHOOT · WIND ${Math.abs(Math.round(g.world.wind / 10))}` : 'TO SHOOT',
      };
    },
  };
}
