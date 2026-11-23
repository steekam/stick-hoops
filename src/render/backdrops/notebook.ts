import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, seeded } from './common';

// Notebook: the game as a doodle on a ruled page. Ruling, margin and binder holes, plus five doodles.

type P = { x: number; y: number };

function wob(ctx: Ctx, r: () => number, pts: P[], w = 1.4, j = 0.7, close = false) {
  for (let k = 0; k < 2; k++) {
    ctx.lineWidth = w * (k ? 0.55 : 1);
    ctx.beginPath();
    pts.forEach((p, i) => { const x = p.x + (r() - 0.5) * j, y = p.y + (r() - 0.5) * j; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (close) ctx.closePath();
    ctx.stroke();
  }
}

function circle(ctx: Ctx, r: () => number, x: number, y: number, rad: number, w = 1.4) {
  for (let k = 0; k < 2; k++) {
    ctx.lineWidth = w * (k ? 0.55 : 1);
    ctx.beginPath();
    const off = r() * 6;
    for (let a = 0; a <= 6.6; a += 0.3) { const rr = rad + (r() - 0.5) * 0.8 + a * 0.05 * k; const px = x + Math.cos(a + off) * rr, py = y + Math.sin(a + off) * rr; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
}

function drawHole(ctx: Ctx, c: Colors, y: number) {
  ctx.save();
  // soft cast shadow, hatched
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.3;
  ctx.beginPath(); ctx.arc(34, y + 2, 11, 0, Math.PI * 2); hatch(ctx, { x: 23, y: y - 9, w: 22, h: 22 }, 2.2, -0.8);
  // hole: paper-coloured so the desk "shows through"
  ctx.fillStyle = c.paper; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(32, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.7; ctx.lineWidth = 1.6; ctx.strokeStyle = c.mute; ctx.stroke();
  // inner shading along top-left edge
  ctx.globalAlpha = 0.45; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(32, y, 8, Math.PI * 0.8, Math.PI * 1.7); ctx.stroke();
  // reinforcement ring
  ctx.globalAlpha = 0.25; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(32, y, 15, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawNotebook(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE, r = seeded(7);
  ctx.save();
  // Ruled lines in blue pencil.
  ctx.strokeStyle = c.paint; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
  for (let y = 46; y < base; y += 24) { path(ctx, [{ x: 0, y }, { x: W, y: y + 0.4 }]); ctx.stroke(); }
  // top header rule, a bit heavier
  ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; path(ctx, [{ x: 0, y: 49 }, { x: W, y: 49.4 }]); ctx.stroke();
  // Margin: red-ish double line.
  ctx.strokeStyle = c.accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4;
  path(ctx, [{ x: 72, y: 0 }, { x: 72.5, y: base }]); ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = 0.9;
  path(ctx, [{ x: 77, y: 0 }, { x: 77.4, y: base }]); ctx.stroke();
  // Binder holes with shading.
  for (const y of [80, 200, 320]) drawHole(ctx, c, y);

  ctx.strokeStyle = c.mute; ctx.fillStyle = c.mute; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.7;
  // A star
  {
    const star: P[] = [];
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 7 : 17; star.push({ x: 140 + Math.cos(a) * rr, y: 100 + Math.sin(a) * rr }); }
    wob(ctx, r, star, 1.4, 0.8, true);
    ctx.globalAlpha = 0.25; ctx.lineWidth = 0.7; path(ctx, star, true); hatch(ctx, { x: 123, y: 83, w: 34, h: 34 }, 3, -0.8);
    ctx.globalAlpha = 0.7;
  }
  // A smiley
  {
    const sx = 250, sy = 330 - 2;
    circle(ctx, r, sx, sy, 13, 1.4);
    ctx.beginPath(); ctx.arc(sx - 4.5, sy - 3, 1.4, 0, 6.3); ctx.arc(sx + 4.5, sy - 3, 1.4, 0, 6.3); ctx.fill();
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(sx, sy + 1, 7, 0.25, Math.PI - 0.25); ctx.stroke();
  }
  // An arrow pointing right (toward the hoop), with a curl
  {
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(660, 340); ctx.bezierCurveTo(700, 310, 740, 355, 770, 322); ctx.stroke();
    ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(660, 342); ctx.bezierCurveTo(700, 313, 740, 358, 768, 325); ctx.stroke();
    wob(ctx, r, [{ x: 756, y: 318 }, { x: 773, y: 321 }, { x: 765, y: 337 }], 1.5, 0.4);
  }
  // "GAME DAY!!" in bubble-ish letters, tilted, underlined twice
  ctx.save(); ctx.translate(180, 156); ctx.rotate(-0.07);
  ctx.font = '900 30px "Comic Sans MS", "Chalkboard SE", ui-monospace, Menlo, Consolas, monospace';
  ctx.lineWidth = 1.3; ctx.globalAlpha = 0.65; ctx.strokeText('GAME DAY!!', 0, 0);
  ctx.globalAlpha = 0.18; ctx.fillText('GAME DAY!!', 0, 0);
  ctx.globalAlpha = 0.7; ctx.lineWidth = 1.4;
  wob(ctx, r, [{ x: -4, y: 9 }, { x: 80, y: 7 }, { x: 170, y: 10 }], 1.5, 0.8);
  wob(ctx, r, [{ x: 6, y: 15 }, { x: 90, y: 14 }, { x: 150, y: 15 }], 1.2, 0.8);
  ctx.restore();
  // A sun, top right, with hatched face-side
  ctx.globalAlpha = 0.7;
  circle(ctx, r, 880, 70, 16, 1.4);
  for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, l = i % 2 ? 26 : 31; path(ctx, [{ x: 880 + Math.cos(a) * 22, y: 70 + Math.sin(a) * 22 }, { x: 880 + Math.cos(a) * l, y: 70 + Math.sin(a) * l }]); ctx.lineWidth = 1.3; ctx.stroke(); }
  ctx.globalAlpha = 0.25; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(880, 70, 15, 0, 6.3); hatch(ctx, { x: 864, y: 54, w: 32, h: 32 }, 3, -0.8);
  ctx.globalAlpha = 0.7;
  ctx.restore();
}

/** One doodle wiggles: the smiley's eyes blink. */
export function drawNotebookLive(ctx: Ctx, c: Colors, time: number): void {
  ctx.save();
  // blink every ~4s: paper-coloured patch over the eyes, with a closed-eye line.
  const ph = time % 4;
  if (ph < 0.18) {
    const sx = 250, sy = 328;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1;
    ctx.fillRect(sx - 7, sy - 6, 14, 6);
    ctx.strokeStyle = c.mute; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.3;
    path(ctx, [{ x: sx - 6, y: sy - 3 }, { x: sx - 3, y: sy - 3 }]); ctx.stroke();
    path(ctx, [{ x: sx + 3, y: sy - 3 }, { x: sx + 6, y: sy - 3 }]); ctx.stroke();
  }
  ctx.restore();
}
