import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, seeded } from './common';

// Notebook: the game as a doodle on a ruled page.

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

function stickFigure(ctx: Ctx, r: () => number, x: number, y: number, arms: number) {
  circle(ctx, r, x, y - 14, 4, 1.2);
  wob(ctx, r, [{ x, y: y - 10 }, { x, y }], 1.2, 0.4);
  wob(ctx, r, [{ x: x - 6, y: y - 8 - arms * 4 }, { x, y: y - 6 }, { x: x + 6, y: y - 8 - (1 - arms) * 4 }], 1.2, 0.4);
  wob(ctx, r, [{ x: x - 5, y: y + 10 }, { x, y }, { x: x + 5, y: y + 10 }], 1.2, 0.4);
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
  // Coffee ring stain (two overlapping rings, with a faint splash).
  ctx.strokeStyle = c.faint; ctx.fillStyle = c.faint;
  for (const [cx, cy, rad, a, w] of [[560, 270, 34, 0.5, 2.6], [566, 274, 33, 0.35, 1.6], [545, 262, 30, 0.2, 1.2]] as number[][]) {
    ctx.globalAlpha = a; ctx.lineWidth = w; ctx.beginPath();
    for (let t = 0.3; t < 6.1; t += 0.2) { const rr = rad + Math.sin(t * 3) * 0.8; const px = cx + Math.cos(t) * rr, py = cy + Math.sin(t) * rr; t > 0.3 ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7; ctx.strokeStyle = c.mute;
  ctx.beginPath(); ctx.arc(563, 272, 28, 3.4, 5.2); hatch(ctx, { x: 530, y: 238, w: 66, h: 66 }, 3, -0.7);
  for (const [dx, dy, rr] of [[40, -20, 3], [46, 8, 2], [-44, 24, 2.4]]) { ctx.beginPath(); ctx.arc(560 + dx, 270 + dy, rr, 0, 6.3); ctx.stroke(); }
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
  // A cube (isometric).
  {
    const cx = 128, cy = 250, s = 20;
    const top: P[] = [{ x: cx, y: cy - s }, { x: cx + s * 0.87, y: cy - s / 2 }, { x: cx, y: cy }, { x: cx - s * 0.87, y: cy - s / 2 }];
    wob(ctx, r, top, 1.3, 0.6, true);
    wob(ctx, r, [{ x: cx - s * 0.87, y: cy - s / 2 }, { x: cx - s * 0.87, y: cy + s / 2 }, { x: cx, y: cy + s }, { x: cx, y: cy }], 1.3, 0.6);
    wob(ctx, r, [{ x: cx, y: cy + s }, { x: cx + s * 0.87, y: cy + s / 2 }, { x: cx + s * 0.87, y: cy - s / 2 }], 1.3, 0.6);
    ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7;
    path(ctx, [{ x: cx, y: cy }, { x: cx + s * 0.87, y: cy - s / 2 }, { x: cx + s * 0.87, y: cy + s / 2 }, { x: cx, y: cy + s }], true);
    hatch(ctx, { x: cx, y: cy - s / 2, w: s, h: s * 1.5 }, 2.6, -0.9);
    ctx.globalAlpha = 0.7;
  }
  // A spiral
  {
    const cx = 120, cy = 330 - 6;
    ctx.lineWidth = 1.3; ctx.beginPath();
    for (let t = 0; t < 19; t += 0.25) { const rr = 1 + t * 0.9; const px = cx + Math.cos(t) * rr, py = cy + Math.sin(t) * rr; t ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
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
  // "3 PTS!" scribbled and underlined twice
  ctx.save(); ctx.translate(640, 128); ctx.rotate(-0.12);
  ctx.font = 'italic 700 22px ui-monospace, Menlo, Consolas, monospace'; ctx.fillText('3 PTS!', 0, 0);
  ctx.lineWidth = 1.5;
  path(ctx, [{ x: -4, y: 8 }, { x: 92, y: 6 }]); ctx.stroke();
  path(ctx, [{ x: 4, y: 13 }, { x: 86, y: 12 }]); ctx.stroke();
  ctx.restore();
  // A little ball with motion lines
  circle(ctx, r, 330, 230, 12, 1.5);
  path(ctx, [{ x: 319, y: 230 }, { x: 341, y: 230 }]); ctx.lineWidth = 1.1; ctx.stroke();
  path(ctx, [{ x: 330, y: 219 }, { x: 330, y: 241 }]); ctx.stroke();
  ctx.beginPath(); ctx.arc(318, 230, 12, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(342, 230, 12, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
  for (const dy of [-8, -1, 6]) wob(ctx, r, [{ x: 286 + dy, y: 230 + dy }, { x: 308, y: 230 + dy }], 1.1, 0.5);
  // A looping squiggle
  ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(700, 200);
  for (let i = 0; i < 40; i++) { const t = i / 6; ctx.lineTo(700 + i * 3 + Math.cos(t * 2) * 8, 200 + Math.sin(t * 2) * 8); }
  ctx.stroke();
  // A little stick-figure crowd cheering, bottom-left of the page
  ctx.globalAlpha = 0.6;
  [[190, 360, 1], [210, 358, 0], [230, 361, 1], [400, 361, 0], [420, 359, 1], [440, 362, 0]].forEach(([x, y, a]) => stickFigure(ctx, r, x, y - 12, a));
  // Taped corner at top-left of the sheet and a folded dog-ear at bottom-right of the backdrop
  ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(790, 8); ctx.rotate(0.05);
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.faint;
  ctx.globalAlpha = 0.85; rect(ctx, 0, 0, 56, 18); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
  // jagged ends
  path(ctx, [{ x: 0, y: 0 }, { x: -2, y: 3 }, { x: 1, y: 6 }, { x: -2, y: 9 }, { x: 1, y: 12 }, { x: -2, y: 15 }, { x: 0, y: 18 }, { x: 56, y: 18 }, { x: 58, y: 15 }, { x: 55, y: 12 }, { x: 58, y: 9 }, { x: 55, y: 6 }, { x: 58, y: 3 }, { x: 56, y: 0 }], true); ctx.stroke();
  ctx.globalAlpha = 0.3; ctx.lineWidth = 0.6; hatch(ctx, { x: 0, y: 0, w: 56, h: 18 }, 4, 0.9);
  ctx.restore();
  // folded corner (top-right)
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.mute; ctx.globalAlpha = 1;
  path(ctx, [{ x: W - 46, y: 0 }, { x: W, y: 0 }, { x: W, y: 46 }], true); ctx.fill();
  ctx.globalAlpha = 0.6; ctx.lineWidth = 1.2; path(ctx, [{ x: W - 46, y: 0 }, { x: W - 46 + 4, y: 40 }, { x: W, y: 46 }]); ctx.stroke();
  path(ctx, [{ x: W - 44, y: 3 }, { x: W - 44, y: 3 }]); ctx.stroke();
  ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7;
  path(ctx, [{ x: W - 42, y: 4 }, { x: W - 4, y: 4 }, { x: W - 4, y: 42 }], true); hatch(ctx, { x: W - 46, y: 0, w: 46, h: 46 }, 3, -0.8);
  ctx.restore();
}

/** One doodle wiggles: the smiley's eyes blink, and the margin star twinkles. */
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
