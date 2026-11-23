import { sfx } from '../../audio/sfx';
import { between, sign } from '../../sim/rng';
import { bestsFor, newBestText, recordRound, recordShot } from '../../stats';
import type { Mode } from '../../game/types';

/** Streak: one miss ends it. Wind builds after two makes; the hoop starts moving after six. */
export function streak(): Mode {
  let n = 0, swishes = 0;
  let best = bestsFor('streak').streak ?? 0;
  return {
    id: 'streak',
    name: 'Streak',
    start(g) { n = 0; swishes = 0; g.placePlayer(between(g.rng, 200, 560), true); },
    aimDots: () => 4,
    onScore(g) {
      g.pop(String(n + 1));
      if ((n + 1) % 5 === 0) g.backflip();
    },
    onShotEnd(g, r) {
      recordShot('streak', r);
      if (r.made) {
        n++;
        if (r.swish) swishes++;
        g.placePlayer(between(g.rng, 190, 580));
        if (n >= 2) g.world.wind = sign(g.rng) * Math.min(30 + n * 22, 230);
        if (n >= 6) { g.world.hoop.my = Math.min((n - 5) * 12, 60); g.world.hoop.sp = 1.2; }
        return;
      }
      const beaten = recordRound('streak', { streak: n, swishes });
      best = Math.max(best, n);
      sfx.fail();
      const sw = swishes ? ` ${swishes} swish${swishes === 1 ? '' : 'es'}.` : '';
      g.showOverlay('Streak over', `${n} in a row.${sw}${newBestText(beaten) || ` Best is ${best}.`}`, [{ label: 'Go again', action: () => g.setMode(streak()) }], {
        best: beaten.includes('streak') && n > 0,
        share: `I hit ${n} in a row in Streak on Stick Hoops.`,
      });
    },
    hud: (g) => ({
      left: 'Streak · one miss ends it',
      mid: g.world.wind ? `WIND ${Math.abs(Math.round(g.world.wind / 10))}` : '',
      right: String(n),
      rightNote: `IN A ROW · BEST ${Math.max(best, n)}`,
    }),
  };
}
