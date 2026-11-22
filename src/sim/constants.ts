// World units: the court is always 960 x 540, scaled to fit the screen.
export const W = 960;
export const H = 540;
export const FLOOR = 488;
/** Gravity, px/s². */
export const G = 980;
/** Ball radius. */
export const R = 11;
/** Fastest launch speed, px/s. */
export const VMAX = 1120;
/** Fixed physics step. The world advances in whole ticks so replays line up exactly. */
export const TICKS_PER_SEC = 240;
export const DT = 1 / TICKS_PER_SEC;
/** Default rim width (front rim to back rim). Sabotage can shrink it. */
export const RIM_W = 50;
