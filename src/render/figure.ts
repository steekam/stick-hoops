import { FLOOR, G, R } from '../sim/constants';
import { clamp } from '../sim/math';
import { releasePoint } from '../sim/shot';
import type { Game } from '../game/game';
import type { Pen } from './pen';

// The stick figure. Render-only: nothing here affects the simulation.

/*
 * Stationary dribble built from measured numbers. Skilled players keep the hand on the ball
 * ~0.39 s per bounce, catch it higher than they release it (about 40% vs 33% of body height),
 * and a regulation ball keeps ~0.85 of its speed on the bounce (FIBA: dropped from 1.8 m it
 * must come back to 1.2–1.4 m). The cycle starts at the top of the hand's ride:
 * push down → fall → floor → rise → catch and ride up.
 */
const DR = (() => {
  const g = G, e = 0.85, fy = FLOOR - R, top = FLOOR - 58, yc = FLOOR - 45, yr = FLOOR - 35, v0 = 280;
  const vf = Math.sqrt(v0 * v0 + 2 * g * (fy - yr)), vu = e * vf;
  const vc = Math.sqrt(Math.max(900, vu * vu - 2 * g * (fy - yc)));
  const ta = (2 * (yr - top)) / v0, t1 = (vf - v0) / g, tk = 0.03, t2 = (vu - vc) / g, tb = (2 * (yc - top)) / vc;
  return { g, fy, top, yc, yr, v0, vu, vc, ta, t1, tk, t2, tb, air: t1 + tk + t2, T: ta + t1 + tk + t2 + tb };
})();

function dribblePose(c: number): { by: number; hy: number; sq: number } {
  const d = DR;
  let t = c, by: number, hy: number, sq = 0;
  const h0 = d.yr - R + 1, h1 = d.yc - R + 1;
  // Hand during flight: a small follow-through dip, then back up to meet the ball.
  const handAir = (k: number) => { const s = k / d.air; return h0 + (h1 - h0) * s + Math.sin(Math.PI * s) * 6; };
  if (t < d.ta) { by = d.top + 0.5 * (d.v0 / d.ta) * t * t; hy = by - R + 1; }
  else if ((t -= d.ta) < d.t1) { by = d.yr + d.v0 * t + 0.5 * d.g * t * t; hy = handAir(t); }
  else if ((t -= d.t1) < d.tk) { by = d.fy; sq = Math.sin((Math.PI * t) / d.tk) * 0.15; hy = handAir(t + d.t1); }
  else if ((t -= d.tk) < d.t2) { by = d.fy - (d.vu * t - 0.5 * d.g * t * t); hy = handAir(t + d.t1 + d.tk); }
  else { t -= d.t2; by = d.yc - (d.vc * t - 0.5 * (d.vc / d.tb) * t * t); hy = by - R + 1; }
  return { by, hy, sq };
}

/*
 * Pre-shot routines while idle: each "set" is three one-hand dribbles, or one two-hand bounce
 * then a catch and a spin. Sets are picked pseudo-randomly from the spot he's standing on.
 */
function routine(t: number, px: number) {
  const seed = Math.round(px);
  for (let k = 0; k < 400; k++) {
    const r = Math.sin((seed + k * 7.13) * 12.9898) * 43758.5453, single = r - Math.floor(r) < 0.4;
    const L = single ? DR.T + 1.9 : 3 * DR.T + 1.2;
    if (t < L) return { phase: t, single, bounces: single ? 1 : 3 };
    t -= L;
  }
  return { phase: t % 1, single: false, bounces: 3 };
}

export interface FigureOut {
  /** Ball drawn by the figure this frame (dribbling or held), if any. */
  ball: { x: number; y: number; rot: number; sq: number } | null;
  /** True on the frame a dribbled ball touches the floor. */
  dribbleContact: boolean;
  dribbleTwoHand: boolean;
  walking: boolean;
}

export function drawFigure(p: Pen, g: Game): FigureOut {
  const { fig, player, aim } = g;
  const k = fig.kind, v = fig.v, t = fig.t;
  const isWalk = g.walking() && !g.ball && k !== 'cheer';
  const pw = g.aimPower();
  const x = player.x;
  let jy = 0, cr = 0, hx = 0, hy = 0, rot = 0, flipP = 0, drib: number | null = null, lean = 0, two = false, spin = 0;
  if (aim) cr = 12 * pw;
  if (k === 'throw') { if (t < 0.45) jy = -Math.sin((t / 0.45) * Math.PI) * 16; else if (t < 0.65) cr = Math.sin(((t - 0.45) / 0.2) * Math.PI) * 9; }
  if (k === 'cheer') {
    if (v === 'flip') { flipP = clamp(t / 0.8, 0, 1); jy = -Math.sin(flipP * Math.PI) * 48; rot = -flipP * Math.PI * 2; if (t > 0.8 && t < 1) cr = Math.sin(((t - 0.8) / 0.2) * Math.PI) * 10; }
    else if (v === 'dab') { hx = -5; hy = 5; }
    else if (v === 'arms') jy = -Math.abs(Math.sin(t * 8)) * 18 * Math.max(0, 1 - t / 1.1);
  }
  if (k === 'slump') { if (v === 'slump') { cr = 6; hx = 5; hy = 7; } else if (v === 'palm') hy = 2; }
  if (!aim && k === 'idle' && !g.ball) {
    if (isWalk) { drib = g.time % DR.T; lean = 3; }
    else {
      const r = routine(t, x);
      lean = 6; cr = 7; two = r.single;
      if (r.phase < r.bounces * DR.T) drib = r.phase % DR.T;
      else { cr += Math.sin(g.time * 2.4); if (r.single) { const q = clamp((r.phase - DR.T - 0.15) / 0.45, 0, 1); spin = (1 - Math.pow(1 - q, 3)) * Math.PI * 3; } }
    }
  }
  const o = jy + cr;
  const S = { x: x + lean, y: FLOOR - 100 + o + lean * 0.4 };
  const Hp = { x: x - 1, y: FLOOR - 54 + o };
  const N = { x: x + lean * 0.9, y: FLOOR - 110 + o + lean * 0.4 };
  const head = { x: x + hx + lean * 1.2, y: FLOOR - 124 + o + hy + lean * 0.4 };
  const ctx = p.ctx;

  p.boil = true;
  ctx.save();
  if (rot) { const cy = FLOOR - 80 + o; ctx.translate(x, cy); ctx.rotate(rot); ctx.translate(-x, -cy); }
  ctx.strokeStyle = p.c.ink; ctx.fillStyle = player.variant === 1 ? p.c.ink : p.c.paper;
  ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(head.x + p.jit(), head.y + p.jit(), 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3.2; p.seg(N, Hp);

  let fA = { x: x - 11, y: FLOOR + Math.min(0, jy) }, fB = { x: x + 11, y: FLOOR + Math.min(0, jy) }, kd = -1;
  if (isWalk) { const s = Math.sin(g.time * 14) * 11; fA.x = x - s; fB.x = x + s; kd = -Math.sign(player.tx - player.x) || -1; }
  if (k === 'cheer' && v === 'flip' && flipP > 0.1 && flipP < 0.9) { fA = { x: x - 4, y: Hp.y + 30 }; fB = { x: x + 8, y: Hp.y + 30 }; }
  if (k === 'cheer' && v === 'moon') { const s = Math.sin(t * 9); fA = { x: x - 4 + s * 9, y: FLOOR - Math.max(0, s) * 7 }; fB = { x: x + 4 - s * 9, y: FLOOR - Math.max(0, -s) * 7 }; }
  if (k === 'slump' && v === 'kick') { const q0 = clamp((t - 0.15) / 0.2, 0, 1), q = t > 0.5 ? clamp(1 - (t - 0.5) / 0.25, 0, 1) : q0; fB = { x: x + 11 + q * 26, y: FLOOR - q * 30 }; }
  p.limb(Hp, fA, kd, 28); p.limb(Hp, fB, kd, 28);

  let A: { x: number; y: number }, B: { x: number; y: number };
  let held: { x: number; y: number } | null = null, dball: { x: number; y: number; sq: number } | null = null;
  if (aim) { const rp = releasePoint(x, pw); held = rp; A = { x: rp.x - 9, y: rp.y + 6 }; B = { x: rp.x + 8, y: rp.y + 7 }; }
  else if (k === 'throw') { const e = Math.min(t / 0.12, 1), d = fig.dir; A = { x: S.x + 4 - 4 * (1 - e) + d.x * 42 * e, y: S.y - 40 * (1 - e) + d.y * 42 * e }; B = { x: x + 12, y: S.y + 28 }; }
  else if (k === 'cheer') {
    if (v === 'dab') { A = { x: x + 40, y: S.y - 30 }; B = { x: head.x - 10, y: head.y + 4 }; }
    else if (v === 'guns') { const r = Math.max(0, Math.sin(t * 18)) * 7; A = { x: x + 42, y: S.y - 4 - r }; B = { x: x + 40, y: S.y + 4 - r }; }
    else if (v === 'moon') { A = { x: x - 12, y: S.y + 38 }; B = { x: x + 10, y: S.y + 36 }; }
    else { A = { x: x - 18, y: S.y - 40 }; B = { x: x + 18, y: S.y - 40 }; }
  } else if (k === 'slump') {
    if (v === 'palm') { A = { x: head.x + 7, y: head.y + 3 }; B = { x: x + 9, y: S.y + 42 }; }
    else if (v === 'kick') { A = { x: x - 30, y: S.y + 12 }; B = { x: x + 26, y: S.y + 16 }; }
    else { A = { x: x - 4, y: S.y + 44 }; B = { x: x + 9, y: S.y + 42 }; }
  } else if (drib != null && two) { const dp = dribblePose(drib), bx = x + 16; dball = { x: bx, y: dp.by, sq: dp.sq }; A = { x: bx - 10, y: dp.hy + 7 }; B = { x: bx + 10, y: dp.hy + 7 }; }
  else if (drib != null) { const dp = dribblePose(drib), bx = x + 18; dball = { x: bx, y: dp.by, sq: dp.sq }; A = isWalk ? { x: x - Math.sin(g.time * 14) * 12, y: S.y + 40 } : { x: x - 6, y: S.y + 40 }; B = { x: bx + 1, y: dp.hy }; }
  else { held = { x: x + 16, y: DR.top }; A = { x: held.x - 9, y: held.y + 3 }; B = { x: held.x + 8, y: held.y + 4 }; }
  p.limb(S, A, 1, 24); p.limb(S, B, 1, 24);
  if (k === 'cheer' && v === 'guns') { ctx.lineWidth = 2.5; p.seg(A, { x: A.x + 7, y: A.y - 2 }); p.seg(B, { x: B.x + 7, y: B.y - 2 }); }
  ctx.restore();
  p.boil = false;

  if (player.tag) {
    ctx.fillStyle = p.c.ink; ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(player.tag, head.x, head.y - 22);
    ctx.textAlign = 'left';
  }

  let ball: FigureOut['ball'] = null;
  if (dball) ball = { x: dball.x, y: dball.y, rot: 0, sq: dball.sq };
  else if (held && !g.ball && k !== 'cheer') ball = { x: held.x, y: held.y - (aim ? 0 : 2), rot: aim ? 0 : spin, sq: 0 };
  return { ball, dribbleContact: !!(dball && dball.sq > 0), dribbleTwoHand: two, walking: isWalk };
}
