import { between } from '../../sim/rng';
import type { Mode } from '../../game/types';

export function practice(): Mode {
  let made = 0, tries = 0;
  return {
    id: 'practice',
    name: 'Practice',
    start(g) { made = 0; tries = 0; g.placePlayer(420, true); },
    aimDots: () => 34,
    onLaunch() { tries++; },
    onShotEnd(g, r) { if (r.made) { made++; g.placePlayer(between(g.rng, 190, 580)); } },
    hud: () => ({ left: 'Practice · full aim guide', mid: '', right: `${made}/${tries}`, rightNote: 'MADE' }),
  };
}
