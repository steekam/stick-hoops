import { FLOOR, W } from '../sim/constants';
import type { Backdrop } from '../settings';
import { hatch, path, proj, Z_BACK } from './iso';
import type { Colors } from './pen';

// Backdrops: what sits behind the court, above the floor's back edge. Static parts are drawn into
// the renderer's cached court layer; the few moving parts (clouds, the scoreboard) are drawn live.

type Ctx = CanvasRenderingContext2D;

/** Screen y of the floor's back edge: everything above it is backdrop. */
export const WALL_BASE = proj(0, FLOOR, Z_BACK).y;

/** A tiny seeded random, so backdrops are the same every frame and every session. */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number) {
  path(ctx, [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], true);
}

/** Floor colour for the backdrop: hardwood indoors, asphalt outside. */
export function floorFill(b: Backdrop, c: Colors): string {
  return b === 'street' ? c.faint : c.wood;
}

// ---------- static layers ----------

export function drawBackdrop(ctx: Ctx, b: Backdrop, c: Colors): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (b === 'gym') gym(ctx, c);
  if (b === 'street') street(ctx, c);
  if (b === 'notebook') notebook(ctx, c);
  ctx.restore();
}

/** Positions shared by the gym's windows and the scoreboard, so they never overlap. */
const SCOREBOARD = { x: 405, y: 22, w: 170, h: 72 };
const GYM_WINDOWS = [60, 220, 630];

function gym(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE;
  // Block wall: staggered courses, very faint.
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.16;
  let row = 0;
  for (let y = base - 24; y > 44; y -= 24, row++) {
    path(ctx, [{ x: 0, y }, { x: W, y }]); ctx.stroke();
    for (let x = row % 2 ? 0 : 30; x < W; x += 60) { path(ctx, [{ x, y }, { x, y: y + 24 }]); ctx.stroke(); }
  }
  // Roof truss across the top.
  ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.45; ctx.lineWidth = 1.6;
  path(ctx, [{ x: 0, y: 12 }, { x: W, y: 12 }]); ctx.stroke();
  path(ctx, [{ x: 0, y: 34 }, { x: W, y: 34 }]); ctx.stroke();
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 44) { path(ctx, [{ x, y: 34 }, { x: x + 22, y: 12 }, { x: x + 44, y: 34 }]); ctx.stroke(); }
  // Tall windows, with light falling through them onto the floor.
  for (const wx of GYM_WINDOWS) {
    const ww = 110, top = 58, bot = 178;
    ctx.globalAlpha = 0.07; ctx.strokeStyle = c.mute; ctx.lineWidth = 1;
    const beam = [{ x: wx, y: bot }, { x: wx + ww, y: bot }, { x: wx + ww + 150, y: base + 40 }, { x: wx + 150, y: base + 40 }];
    path(ctx, beam, true); hatch(ctx, { x: wx, y: bot, w: ww + 150, h: base + 40 - bot }, 7, -0.95);
    ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
    path(ctx, [beam[0], beam[3]]); ctx.stroke();
    path(ctx, [beam[1], beam[2]]); ctx.stroke();
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1;
    rect(ctx, wx, top, ww, bot - top); ctx.fill();
    ctx.strokeStyle = c.mute; ctx.globalAlpha = 0.3; ctx.lineWidth = 0.8;
    rect(ctx, wx, top, ww, bot - top); hatch(ctx, { x: wx, y: top, w: ww, h: bot - top }, 9, -0.95);
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
    rect(ctx, wx, top, ww, bot - top); ctx.stroke();
    ctx.lineWidth = 1.2;
    path(ctx, [{ x: wx + ww / 3, y: top }, { x: wx + ww / 3, y: bot }]); ctx.stroke();
    path(ctx, [{ x: wx + (2 * ww) / 3, y: top }, { x: wx + (2 * ww) / 3, y: bot }]); ctx.stroke();
    path(ctx, [{ x: wx, y: top + 60 }, { x: wx + ww, y: top + 60 }]); ctx.stroke();
  }
  // Pull-out bleachers along the left of the wall, empty.
  ctx.strokeStyle = c.ink;
  for (let i = 0; i < 4; i++) {
    const y = base - (i + 1) * 20, x1 = 360 - i * 18;
    const riser = [{ x: 0, y }, { x: x1, y }, { x: x1, y: y + 20 }, { x: 0, y: y + 20 }];
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; path(ctx, riser, true); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.lineWidth = 0.8; path(ctx, riser, true); hatch(ctx, { x: 0, y, w: x1, h: 20 }, 4, 0);
    ctx.globalAlpha = 0.7; ctx.lineWidth = 2; path(ctx, [{ x: 0, y }, { x: x1, y }]); ctx.stroke();
    ctx.lineWidth = 1.2; path(ctx, [{ x: x1, y }, { x: x1, y: y + 20 }]); ctx.stroke();
  }
  // Two championship banners hanging from the truss, in the court's blue.
  [[800, 'B'], [868, '24']].forEach(([bx, label]) => {
    const x = bx as number, y = 36, w = 52, h = 84;
    const shape = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x: x + w / 2, y: y + h - 14 }, { x, y: y + h }];
    ctx.globalAlpha = 1; ctx.fillStyle = c.paint; path(ctx, shape, true); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 0.8; path(ctx, shape, true); hatch(ctx, { x, y, w, h }, 5, -0.9);
    ctx.globalAlpha = 0.8; ctx.lineWidth = 2; path(ctx, shape, true); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.85; ctx.font = '800 20px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText(label as string, x + w / 2, y + 44); ctx.textAlign = 'left';
  });
  ctx.globalAlpha = 1;
}

function street(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE, r = seeded(11);
  // City skyline, far off and faint.
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.paper;
  let x = -10;
  while (x < W) {
    const w = 50 + r() * 70, h = 70 + r() * 150, y = base - 120 - h + 120;
    const top = base - 60 - h;
    ctx.globalAlpha = 1; rect(ctx, x, top, w, base - top); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2; rect(ctx, x, top, w, base - top); ctx.stroke();
    ctx.globalAlpha = 0.28; ctx.lineWidth = 0.7;
    for (let wy = top + 10; wy < base - 70; wy += 16) for (let wx = x + 8; wx < x + w - 10; wx += 14) {
      if (r() < 0.55) { rect(ctx, wx, wy, 6, 8); hatch(ctx, { x: wx, y: wy, w: 6, h: 8 }, 2.2, -0.8); }
    }
    x += w + 4 + r() * 10;
    void y;
  }
  // Chain-link fence along the back of the court.
  const top = base - 150;
  ctx.fillStyle = c.paper; ctx.globalAlpha = 0.55; rect(ctx, 0, top, W, base - top); ctx.fill();
  ctx.strokeStyle = c.ink; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.22;
  rect(ctx, 0, top, W, base - top); hatch(ctx, { x: 0, y: top, w: W, h: base - top }, 9, Math.PI / 4);
  rect(ctx, 0, top, W, base - top); hatch(ctx, { x: 0, y: top, w: W, h: base - top }, 9, -Math.PI / 4);
  ctx.globalAlpha = 0.7; ctx.lineWidth = 2.2;
  path(ctx, [{ x: 0, y: top }, { x: W, y: top }]); ctx.stroke();
  for (let px = 40; px < W; px += 150) { path(ctx, [{ x: px, y: top - 4 }, { x: px, y: base }]); ctx.stroke(); }
  // A street lamp on the left.
  ctx.globalAlpha = 0.85; ctx.lineWidth = 3;
  path(ctx, [{ x: 18, y: base }, { x: 18, y: 70 }]); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, 70); ctx.quadraticCurveTo(22, 52, 46, 56); ctx.stroke();
  ctx.fillStyle = c.paper; rect(ctx, 38, 56, 22, 9); ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;
}

function notebook(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE;
  // Ruled lines in pale blue, a margin line, and the binder holes.
  ctx.strokeStyle = c.paint; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
  for (let y = 46; y < base; y += 24) { path(ctx, [{ x: 0, y }, { x: W, y }]); ctx.stroke(); }
  ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.4;
  path(ctx, [{ x: 74, y: 0 }, { x: 74, y: base }]); ctx.stroke();
  ctx.strokeStyle = c.mute; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4; ctx.fillStyle = c.faint;
  for (const y of [80, 200, 320]) { ctx.beginPath(); ctx.arc(32, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  // Margin doodles in pencil.
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.mute; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.75;
  // a star
  const star = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 7 : 17; star.push({ x: 150 + Math.cos(a) * rr, y: 92 + Math.sin(a) * rr }); }
  path(ctx, star, true); ctx.stroke();
  // a sun, top right
  ctx.beginPath(); ctx.arc(880, 70, 16, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5; path(ctx, [{ x: 880 + Math.cos(a) * 22, y: 70 + Math.sin(a) * 22 }, { x: 880 + Math.cos(a) * 30, y: 70 + Math.sin(a) * 30 }]); ctx.stroke(); }
  // "3 PTS!" scribbled and underlined twice
  ctx.save(); ctx.translate(640, 128); ctx.rotate(-0.12); // clear of the scoreboard
  ctx.font = 'italic 700 22px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText('3 PTS!', 0, 0);
  path(ctx, [{ x: -4, y: 8 }, { x: 92, y: 6 }]); ctx.stroke();
  path(ctx, [{ x: 4, y: 13 }, { x: 86, y: 12 }]); ctx.stroke();
  ctx.restore();
  // a little ball with motion lines
  ctx.beginPath(); ctx.arc(300, 160, 11, 0, Math.PI * 2); ctx.stroke();
  path(ctx, [{ x: 289, y: 160 }, { x: 311, y: 160 }]); ctx.stroke();
  path(ctx, [{ x: 300, y: 149 }, { x: 300, y: 171 }]); ctx.stroke();
  for (const dy of [-6, 0, 6]) { path(ctx, [{ x: 268, y: 160 + dy }, { x: 282, y: 160 + dy }]); ctx.stroke(); }
  // a looping squiggle
  ctx.beginPath(); ctx.moveTo(700, 200);
  for (let i = 0; i < 40; i++) { const t = i / 6; ctx.lineTo(700 + i * 3 + Math.cos(t * 2) * 8, 200 + Math.sin(t * 2) * 8); }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ---------- live layers ----------

/** Things that move: drifting clouds outside. */
export function drawBackdropLive(ctx: Ctx, b: Backdrop, c: Colors, time: number): void {
  if (b !== 'street') return;
  ctx.save();
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.paper; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
  [[120, 60, 1], [520, 40, 0.8], [800, 90, 1.2]].forEach(([x0, y, s], i) => {
    const x = ((x0 + time * (6 + i * 3)) % (W + 200)) - 100;
    ctx.beginPath();
    ctx.arc(x, y, 14 * s, Math.PI * 0.9, Math.PI * 1.9);
    ctx.arc(x + 20 * s, y - 8 * s, 18 * s, Math.PI * 1.1, Math.PI * 1.95);
    ctx.arc(x + 44 * s, y, 14 * s, Math.PI * 1.2, Math.PI * 0.1);
    ctx.lineTo(x - 14 * s, y + 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  });
  ctx.restore();
}

export interface ScoreLines { big: string; small: string; label: string }

/** A scoreboard hanging from the ceiling, showing the live score in orange digits. */
export function drawScoreboard(ctx: Ctx, c: Colors, s: ScoreLines): void {
  const { x, y, w, h } = SCOREBOARD;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.6;
  path(ctx, [{ x: x + 24, y: 0 }, { x: x + 24, y }]); ctx.stroke();
  path(ctx, [{ x: x + w - 24, y: 0 }, { x: x + w - 24, y }]); ctx.stroke();
  // Body: a box seen slightly from below, with a hatched underside.
  ctx.globalAlpha = 1; ctx.fillStyle = c.paper;
  rect(ctx, x, y, w, h); ctx.fill();
  const under = [{ x, y: y + h }, { x: x + w, y: y + h }, { x: x + w - 8, y: y + h + 8 }, { x: x + 8, y: y + h + 8 }];
  path(ctx, under, true); ctx.fill();
  ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6; path(ctx, under, true); hatch(ctx, { x, y: y + h, w, h: 8 }, 3, -0.8);
  ctx.globalAlpha = 1; ctx.lineWidth = 2.4; rect(ctx, x, y, w, h); ctx.stroke(); path(ctx, under, true); ctx.stroke();
  ctx.lineWidth = 1.2; rect(ctx, x + 6, y + 6, w - 12, h - 12); ctx.stroke();
  // Readout.
  ctx.textAlign = 'center';
  ctx.fillStyle = c.mute; ctx.font = '700 9px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(s.label.toUpperCase().slice(0, 24), x + w / 2, y + 19);
  ctx.fillStyle = c.accent; ctx.font = '800 30px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(s.big.slice(0, 6), x + w / 2, y + 50);
  ctx.fillStyle = c.ink; ctx.font = '700 11px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(s.small.slice(0, 22), x + w / 2, y + 64);
  ctx.restore();
}
