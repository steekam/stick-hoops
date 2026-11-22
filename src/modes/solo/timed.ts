import { sfx } from '../../audio/sfx';
import { scoreShot } from '../../sim/scoring';
import { between } from '../../sim/rng';
import { store } from '../../storage';
import type { Game } from '../../game/game';
import type { Mode } from '../../game/types';

export const ROUND_SECONDS = 60;

/** 60 Seconds: as many points as you can before the buzzer. The clock starts on the first shot. */
export function timed(): Mode {
  let score = 0, left = ROUND_SECONDS, running = false, over = false, streak = 0;
  let best = store.get('bestTime', 0);

  function finish(g: Game): void {
    over = true;
    sfx.buzzer();
    const nb = score > best;
    if (nb) { best = score; store.set('bestTime', score); }
    g.showOverlay('Time', `${score} points.${nb && score > 0 ? ' New best.' : ` Best is ${best}.`}`, [{ label: 'Play again', action: () => g.setMode(timed()) }]);
  }

  return {
    id: 'time',
    name: '60 Seconds',
    start(g) { score = 0; left = ROUND_SECONDS; running = false; over = false; streak = 0; g.placePlayer(between(g.rng, 190, 570), true); },
    aimDots: () => 9,
    canShoot: () => !over,
    onLaunch() { running = true; },
    onShotEnd(g, r) {
      const s = scoreShot(r, { streak });
      streak = r.made ? streak + 1 : 0;
      if (r.made) {
        score += s.total;
        g.pop(`+${s.total}${r.swish ? ' SWISH' : ''}`);
        g.placePlayer(between(g.rng, 190, 570));
      }
      if (left <= 0 && !over) finish(g);
    },
    update(g, dt) {
      if (!running || over) return;
      left -= dt;
      if (left <= 0) { left = 0; running = false; if (!g.ball) finish(g); }
    },
    hud() {
      const s = Math.ceil(left);
      return {
        left: running || over ? '60 Seconds' : '60 Seconds · clock starts on first shot',
        mid: s >= 60 ? '1:00' : `0:${String(s).padStart(2, '0')}`,
        right: String(score),
        rightNote: `PTS · BEST ${best}`,
      };
    },
  };
}
