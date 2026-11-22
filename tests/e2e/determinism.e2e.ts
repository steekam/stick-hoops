import { makeRng } from '../../src/sim/rng';
import { makeLaunch, simulateShot } from '../../src/sim/shot';
import { makeWorld } from '../../src/sim/world';
import { FLOOR } from '../../src/sim/constants';
import { evaluate, expect, open, test } from './fixtures';

test('browser and Node simulate 500 shots identically', async ({ browser }) => {
  await open(browser);
  const worlds = [
    makeWorld(),
    makeWorld({ wind: -170 }),
    makeWorld({ hoop: { bx: 790, by: FLOOR - 250, mx: 0, my: 0, sp: 1 }, wall: { x: 600, w: 16, h: 190 } }),
    makeWorld({ hoop: { bx: 790, by: FLOOR - 210, mx: 35, my: 50, sp: 1.4 }, wall: { x: 600, w: 16, h: 200 }, wind: -110 }),
    makeWorld({ rimW: 34, wind: 160 }),
  ];
  const rng = makeRng(2026);
  const cases = Array.from({ length: 500 }, (_, i) => ({
    w: worlds[i % worlds.length],
    l: makeLaunch(Math.floor(rng() * 20000), 180 + rng() * 420, 250 + rng() * 700, -250 - rng() * 700),
  }));
  const node = cases.map((c) => simulateShot(c.w, c.l));
  const inBrowser = await evaluate<unknown[]>(
    browser,
    (cs: { w: unknown; l: unknown }[]) => cs.map((c) => (window as unknown as { __test: { simulate: (w: unknown, l: unknown) => unknown } }).__test.simulate(c.w, c.l)),
    cases,
  );
  expect(inBrowser).toEqual(node);
  expect(node.some((r) => r.made)).toBe(true);
  expect(node.some((r) => !r.made)).toBe(true);
});
