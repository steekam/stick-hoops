import { Ctx, Colors, hatch, path, rect, SCOREBOARD } from './common';

// The scoreboard hanging over the court. Drawn every frame, on top of any backdrop.

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
