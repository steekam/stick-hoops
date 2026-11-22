import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, SCOREBOARD, seeded } from './common';

// Gym: an indoor arena wall behind the court.

const GYM_WINDOWS = [60, 220, 630];

export function drawGym(ctx: Ctx, c: Colors): void {
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

/** Moving parts of the gym, drawn every frame (none yet). */
export function drawGymLive(_ctx: Ctx, _c: Colors, _time: number): void {}
