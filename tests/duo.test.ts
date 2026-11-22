import { describe, expect, it } from 'vitest';
import { horseInit, horseShooter, horseShot } from '../src/modes/duo/horse';
import { arm, canArm, sabBeginTurn, sabInit, sabShooter, sabShot, suddenDeath } from '../src/modes/duo/sabotage';

describe('HORSE rules', () => {
  it('setter keeps setting until a miss; a missed match is a letter', () => {
    const s = horseInit(0);
    expect(horseShooter(s)).toBe(0);
    expect(horseShot(s, true)).toBe('set-made');
    expect(horseShooter(s)).toBe(1);
    expect(horseShot(s, false)).toBe('match-miss');
    expect(s.letters).toEqual([0, 1]);
    expect(horseShooter(s)).toBe(0); // P1 sets again
    expect(horseShot(s, false)).toBe('set-miss');
    expect(horseShooter(s)).toBe(1); // control passes
    expect(s.phase).toBe('set');
  });

  it('a made match costs nothing', () => {
    const s = horseInit(1);
    horseShot(s, true);
    expect(horseShot(s, true)).toBe('match-made');
    expect(s.letters).toEqual([0, 0]);
    expect(horseShooter(s)).toBe(1);
  });

  it('fifth letter ends it', () => {
    const s = horseInit(0);
    let ev = '';
    for (let i = 0; i < 5; i++) { horseShot(s, true); ev = horseShot(s, false); }
    expect(ev).toBe('over');
    expect(s.loser).toBe(1);
    expect(horseShot(s, true)).toBe('over');
  });
});

describe('Sabotage rules', () => {
  it('alternates and ends after five each', () => {
    const s = sabInit(0);
    const order: number[] = [];
    let done = false;
    for (let i = 0; i < 10; i++) { order.push(sabShooter(s)); done = sabShot(s, i === 0, i === 0 ? 3 : 0); }
    expect(order).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
    expect(done).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('tie goes to sudden death, decided only after both shoot', () => {
    const s = sabInit(0);
    for (let i = 0; i < 10; i++) sabShot(s, false, 0);
    expect(s.winner).toBeNull();
    expect(suddenDeath(s)).toBe(true);
    expect(sabShot(s, true, 2)).toBe(false); // P2 still gets a shot
    expect(sabShot(s, true, 2)).toBe(false); // tied again, another round
    expect(sabShot(s, false, 0)).toBe(false);
    expect(sabShot(s, true, 2)).toBe(true);
    expect(s.winner).toBe(1);
  });

  it('two makes charge a power-up that hits only the next opponent shot', () => {
    const s = sabInit(0);
    sabShot(s, true, 2); sabShot(s, false, 0); sabShot(s, true, 2);
    expect(canArm(s, 0)).toBe(true);
    arm(s, 0, 'tight');
    expect(s.charge[0]).toBe(0);
    expect(sabBeginTurn(s)?.kind).toBe('tight'); // P2's turn
    sabShot(s, false, 0);
    expect(s.active).toBeNull();
    expect(sabBeginTurn(s)).toBeNull(); // back to P1, nothing armed
  });

  it('streaks reset on a miss', () => {
    const s = sabInit(0);
    sabShot(s, true, 2); sabShot(s, true, 2); sabShot(s, false, 0);
    expect(s.streaks).toEqual([0, 1]);
  });
});
