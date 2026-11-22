import { sfx } from '../../audio/sfx';
import { between, sign } from '../../sim/rng';
import { store } from '../../storage';
import type { Mode } from '../../game/types';

/** Streak: one miss ends it. Wind builds after two makes; the hoop starts moving after six. */
export function streak(): Mode {
  let n = 0;
  let best = store.get('bestStreak', 0);
  return {
    id: 'streak',
    name: 'Streak',
    start(g) { n = 0; g.placePlayer(between(g.rng, 200, 560), true); },
    aimDots: () => 4,
    onScore(g) {
      g.pop(String(n + 1));
      if ((n + 1) % 5 === 0) g.backflip();
    },
    onShotEnd(g, r) {
      if (r.made) {
        n++;
        g.placePlayer(between(g.rng, 190, 580));
        if (n >= 2) g.world.wind = sign(g.rng) * Math.min(30 + n * 22, 230);
        if (n >= 6) { g.world.hoop.my = Math.min((n - 5) * 12, 60); g.world.hoop.sp = 1.2; }
        return;
      }
      const nb = n > best;
      if (nb) { best = n; store.set('bestStreak', n); }
      sfx.fail();
      g.showOverlay('Streak over', `${n} in a row.${nb && n > 0 ? ' New best.' : ` Best is ${best}.`}`, [{ label: 'Go again', action: () => g.setMode(streak()) }]);
    },
    hud: (g) => ({
      left: 'Streak · one miss ends it',
      mid: g.world.wind ? `WIND ${Math.abs(Math.round(g.world.wind / 10))}` : '',
      right: String(n),
      rightNote: `IN A ROW · BEST ${best}`,
    }),
  };
}
