import { between } from '../../sim/rng';
import { popLabel, scoreShot } from '../../sim/scoring';
import { recordRound, recordShot } from '../../stats';
import type { Mode } from '../../game/types';

/** Practice: full aim guide, no clock. Points per make and a running session score. */
export function practice(): Mode {
  let made = 0, tries = 0, score = 0, streak = 0, swishes = 0;
  return {
    id: 'practice',
    name: 'Practice',
    start(g) { made = 0; tries = 0; score = 0; streak = 0; swishes = 0; g.placePlayer(420, true); },
    aimDots: () => 34,
    onLaunch() { tries++; },
    onShotEnd(g, r) {
      recordShot('practice', r);
      const s = scoreShot(r, { streak });
      if (!r.made) { streak = 0; return; }
      made++;
      streak++;
      if (r.swish) swishes++;
      score += s.total;
      // Centred left of the default spot so long labels clear the backboard.
      g.pop(popLabel(s));
      // No round end in practice, so the session's records are kept as they grow.
      recordRound('practice', { score, streak, swishes });
      g.placePlayer(between(g.rng, 190, 580));
    },
    hud: () => ({
      left: 'Practice · full aim guide',
      mid: `${made}/${tries} MADE`,
      right: String(score),
      rightNote: 'PTS',
    }),
  };
}
