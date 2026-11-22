import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, SCOREBOARD, seeded } from './common';

// Notebook: the game as a doodle on a ruled page.

export function drawNotebook(ctx: Ctx, c: Colors): void {
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

/** Moving parts of the notebook, drawn every frame (none yet). */
export function drawNotebookLive(_ctx: Ctx, _c: Colors, _time: number): void {}
