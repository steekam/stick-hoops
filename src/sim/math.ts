// Deterministic math for the simulation.
//
// The server re-runs every shot to verify scores, so the physics must produce bit-identical
// results in every browser and on the server. +, -, *, / and Math.sqrt are exactly specified
// by IEEE 754, but Math.sin, Math.cos and Math.hypot are not: engines are free to differ in
// the last bits. So the simulation only uses the functions in this file.

const TAU = 6.283185307179586;
const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;

/** sin(x) from a fixed polynomial after range reduction. Max error ~1e-7, identical everywhere. */
export function dsin(x: number): number {
  x = x - TAU * Math.round(x / TAU); // now in [-π, π]
  if (x > HALF_PI) x = PI - x;
  else if (x < -HALF_PI) x = -PI - x; // now in [-π/2, π/2]
  const x2 = x * x;
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800))))));
}

export const dcos = (x: number): number => dsin(x + HALF_PI);

/** Length of a vector, using only sqrt (exact), never Math.hypot (not exact). */
export const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

/** Snap a velocity to 1/16 px/s so a shot can be stored and replayed as exact integers. */
export const quantize = (v: number): number => Math.round(v * 16) / 16;
