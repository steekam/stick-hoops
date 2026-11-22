import { sfx } from '../../audio/sfx';
import { popLabel, scoreShot, streakMultiplier } from '../../sim/scoring';
import { between } from '../../sim/rng';
import { bestsFor, newBestText, recordRound, recordShot } from '../../stats';
import type { Game } from '../../game/game';
import type { Mode } from '../../game/types';

export const ROUND_SECONDS = 60;

/** 60 Seconds: as many points as you can before the buzzer. The clock starts on the first shot. */
export function timed(): Mode {
  let score = 0, left = ROUND_SECONDS, running = false, over = false;
  let streak = 0, longest = 0, swishes = 0;
  let best = bestsFor('time').score ?? 0;

  function finish(g: Game): void {
    over = true;
    sfx.buzzer();
    const beaten = recordRound('time', { score, streak: longest, swishes });
    best = Math.max(best, score);
    const extra = `${swishes} swish${swishes === 1 ? '' : 'es'}, longest run ${longest}.`;
    const tail = newBestText(beaten) || ` Best is ${best}.`;
    g.showOverlay('Time', `${score} points. ${extra}${tail}`, [{ label: 'Play again', action: () => g.setMode(timed()) }]);
  }

  return {
    id: 'time',
    name: '60 Seconds',
    start(g) {
      score = 0; left = ROUND_SECONDS; running = false; over = false;
      streak = 0; longest = 0; swishes = 0;
      g.placePlayer(between(g.rng, 190, 570), true);
    },
    aimDots: () => 9,
    canShoot: () => !over,
    onLaunch() { running = true; },
    onShotEnd(g, r) {
      recordShot('time', r);
      const s = scoreShot(r, { streak });
      streak = r.made ? streak + 1 : 0;
      longest = Math.max(longest, streak);
      if (r.made) {
        if (r.swish) swishes++;
        score += s.total;
        // Centred left of the default spot so long labels clear the backboard.
        g.pop(popLabel(s));
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
      const clock = s >= 60 ? '1:00' : `0:${String(s).padStart(2, '0')}`;
      // The multiplier the next make would get.
      const x = over ? 1 : streakMultiplier(streak + 1);
      return {
        left: running || over ? '60 Seconds' : '60 Seconds · clock starts on first shot',
        mid: x > 1 ? `${clock} · ×${x}` : clock,
        right: String(score),
        rightNote: `PTS · BEST ${best}`,
      };
    },
  };
}
