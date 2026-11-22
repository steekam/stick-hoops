import {
  BANK_PTS, BUCKET_PTS, DIST_MAX, DIST_MAX_PTS, DIST_MIN, MOVING_PTS, STREAK_TIERS, SWISH_PTS, WALL_PTS,
  distancePts, popLabel, scoreShot, streakMultiplier,
} from '../src/sim/scoring';
import type { ShotResult } from '../src/sim/shot';

const shot = (p: Partial<ShotResult> = {}): ShotResult => ({
  made: true, swish: false, bank: false, offWall: false, movingHoop: false, rimOut: false,
  distance: 100, launch: { tick: 0, px: 0, vx: 0, vy: 0 }, ticks: 0, ...p,
});
const part = (r: ShotResult, label: string) => scoreShot(r, { streak: 0 }).parts.find((p) => p.label === label)?.pts;

describe('scoring parts', () => {
  it('a plain close make is a 2-point bucket', () => {
    const s = scoreShot(shot(), { streak: 0 });
    expect(s).toEqual({ base: 2, multiplier: 1, total: 2, parts: [{ label: 'Bucket', pts: BUCKET_PTS }] });
  });

  it('each trick adds its own part', () => {
    expect(part(shot({ swish: true }), 'Swish')).toBe(SWISH_PTS);
    expect(part(shot({ bank: true }), 'Bank shot')).toBe(BANK_PTS);
    expect(part(shot({ offWall: true }), 'Off the wall')).toBe(WALL_PTS);
    expect(part(shot({ movingHoop: true }), 'Moving hoop')).toBe(MOVING_PTS);
    expect([SWISH_PTS, BANK_PTS, WALL_PTS, MOVING_PTS]).toEqual([1, 1, 2, 1]);
  });

  it('everything stacks', () => {
    const s = scoreShot(shot({ swish: true, bank: true, offWall: true, movingHoop: true, distance: 600 }), { streak: 0 });
    expect(s.base).toBe(2 + 2 + 1 + 1 + 2 + 1);
    expect(s.total).toBe(s.base);
  });

  it('a miss scores nothing, whatever the streak or tricks', () => {
    expect(scoreShot(shot({ made: false, distance: 600 }), { streak: 9 })).toEqual({ base: 0, multiplier: 1, total: 0, parts: [] });
  });
});

describe('distance curve', () => {
  it('is 0 up to the minimum and has no part', () => {
    expect([DIST_MIN, DIST_MAX, DIST_MAX_PTS]).toEqual([220, 560, 2]);
    expect(distancePts(0)).toBe(0);
    expect(distancePts(220)).toBe(0);
    expect(part(shot({ distance: 220 }), 'Distance')).toBeUndefined();
  });

  it('rounds to the nearest point along the slope', () => {
    expect(distancePts(304)).toBe(0); // 0.494
    expect(distancePts(305)).toBe(1); // 0.5 rounds up
    expect(distancePts(390)).toBe(1);
    expect(distancePts(474)).toBe(1); // 1.494
    expect(distancePts(475)).toBe(2); // 1.5
    expect(part(shot({ distance: 400 }), 'Distance')).toBe(1);
  });

  it('caps at +2 from the maximum on', () => {
    expect(distancePts(560)).toBe(2);
    expect(distancePts(900)).toBe(2);
  });
});

describe('streak multiplier', () => {
  it('thresholds: x2 from the 3rd make, x3 from the 6th, x4 from the 10th', () => {
    expect(STREAK_TIERS.map((t) => [t.from, t.x])).toEqual([[10, 4], [6, 3], [3, 2]]);
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 30].map(streakMultiplier);
    expect(xs).toEqual([1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4]);
  });

  it('uses the streak before this shot plus this make', () => {
    expect(scoreShot(shot(), { streak: 1 }).multiplier).toBe(1);
    expect(scoreShot(shot(), { streak: 2 }).multiplier).toBe(2);
    expect(scoreShot(shot(), { streak: 5 }).multiplier).toBe(3);
    expect(scoreShot(shot(), { streak: 9 }).multiplier).toBe(4);
  });

  it('total is base x multiplier', () => {
    const s = scoreShot(shot({ swish: true, distance: 600 }), { streak: 2 });
    expect(s.base).toBe(5);
    expect(s.total).toBe(10);
    expect(popLabel(s)).toBe('+10 SWISH ×2');
  });
});
