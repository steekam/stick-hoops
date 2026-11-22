// Seeded random numbers (mulberry32). Same seed, same sequence, on every machine.
// Anything that must replay on the server (spots, wind, power-ups) draws from one of these.

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (r: Rng, a: number, b: number): number => a + r() * (b - a);
export const sign = (r: Rng): number => (r() < 0.5 ? -1 : 1);
export const randomSeed = (): number => (Math.random() * 4294967296) >>> 0;
