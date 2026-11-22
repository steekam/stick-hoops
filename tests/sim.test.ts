import { dsin, dcos } from '../src/sim/math';
import { makeRng } from '../src/sim/rng';
import { launchBall, makeLaunch, shotOver, simulateShot, stepBall } from '../src/sim/shot';
import { makeWorld } from '../src/sim/world';
import { FLOOR } from '../src/sim/constants';

describe('deterministic math', () => {
  it('dsin tracks Math.sin closely', () => {
    let worst = 0;
    for (let x = -50; x <= 50; x += 0.0137) worst = Math.max(worst, Math.abs(dsin(x) - Math.sin(x)), Math.abs(dcos(x) - Math.cos(x)));
    expect(worst).toBeLessThan(1e-6);
  });

  it('seeded rng repeats', () => {
    const a = makeRng(42), b = makeRng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
});

describe('shots replay exactly', () => {
  const world = makeWorld({ hoop: { bx: 790, by: FLOOR - 230, mx: 40, my: 50, sp: 1.3 }, wall: { x: 600, w: 16, h: 150 }, wind: -120 });

  it('simulateShot matches tick-by-tick stepping', () => {
    const l = makeLaunch(1234, 300, 612.3, -655.9);
    const b = launchBall(l);
    let tick = l.tick;
    while (!shotOver(b)) stepBall(world, b, ++tick, null);
    const r = simulateShot(world, l);
    expect(r.ticks).toBe(b.ticks);
    expect(r.made).toBe(b.scored);
  });

  it('the same launch always gives the same result', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 200; i++) {
      const l = makeLaunch(Math.floor(rng() * 10000), 180 + rng() * 400, 300 + rng() * 600, -300 - rng() * 600);
      expect(simulateShot(world, l)).toEqual(simulateShot(world, l));
    }
  });

  it('launches are quantized to 1/16 px/s', () => {
    const l = makeLaunch(0, 300.04, 500.01, -600.03);
    expect(l.vx * 16).toBe(Math.round(l.vx * 16));
    expect(l.vy * 16).toBe(Math.round(l.vy * 16));
  });

  // Golden values: if these change, every stored replay is invalid. Bump a protocol version.
  it('golden shot', () => {
    const flat = makeWorld();
    const r = simulateShot(flat, makeLaunch(0, 540, 470, -560));
    expect({ made: r.made, ticks: r.ticks }).toMatchSnapshot();
  });
});
