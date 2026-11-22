import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, seeded } from './common';

// Street: an outdoor court at golden hour, with brick buildings, a chain-link fence and a lamp.

type P = { x: number; y: number };

/** A pencil line: two slightly different strokes, like a hand going over it twice. */
function pline(ctx: Ctx, r: () => number, a: P, b: P, w = 1, j = 0.8) {
  for (let k = 0; k < 2; k++) {
    ctx.lineWidth = w * (k ? 0.6 : 1);
    ctx.beginPath();
    ctx.moveTo(a.x + (r() - 0.5) * j, a.y + (r() - 0.5) * j);
    ctx.quadraticCurveTo((a.x + b.x) / 2 + (r() - 0.5) * j * 2, (a.y + b.y) / 2 + (r() - 0.5) * j * 2, b.x + (r() - 0.5) * j, b.y + (r() - 0.5) * j);
    ctx.stroke();
  }
}

function box(ctx: Ctx, r: () => number, x: number, y: number, w: number, h: number, lw = 1.2) {
  pline(ctx, r, { x, y }, { x: x + w, y }, lw);
  pline(ctx, r, { x: x + w, y }, { x: x + w, y: y + h }, lw);
  pline(ctx, r, { x: x + w, y: y + h }, { x, y: y + h }, lw);
  pline(ctx, r, { x, y: y + h }, { x, y }, lw);
}

function hatchRect(ctx: Ctx, x: number, y: number, w: number, h: number, gap: number, ang: number) {
  rect(ctx, x, y, w, h); hatch(ctx, { x, y, w, h }, gap, ang);
}

function building(ctx: Ctx, c: Colors, r: () => number, x: number, top: number, w: number, base: number, o: { brick?: boolean; lit?: number; detail?: boolean }) {
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.mute;
  ctx.globalAlpha = 1; rect(ctx, x, top, w, base - top); ctx.fill();
  ctx.globalAlpha = 0.55; box(ctx, r, x, top, w, base - top, 1.3);
  // shaded right-hand side
  ctx.globalAlpha = 0.22; ctx.lineWidth = 0.7;
  hatchRect(ctx, x + w * 0.78, top, w * 0.22, base - top, 4, -Math.PI / 4);
  // roof cornice
  ctx.globalAlpha = 0.5; pline(ctx, r, { x: x - 3, y: top - 3 }, { x: x + w + 3, y: top - 3 }, 1.5);
  if (o.brick) {
    ctx.globalAlpha = 0.16; ctx.lineWidth = 0.6;
    for (let by = top + 6; by < base - 140; by += 7) {
      path(ctx, [{ x, y: by }, { x: x + w, y: by }]); ctx.stroke();
      for (let bx = x + ((by / 7) % 2 ? 5 : 0); bx < x + w; bx += 10) { path(ctx, [{ x: bx, y: by }, { x: bx, y: by + 7 }]); ctx.stroke(); }
    }
  }
  // windows
  const wy0 = top + 14;
  for (let wy = wy0; wy < base - 150; wy += 30) for (let wx = x + 12; wx < x + w - 20; wx += 24) {
    const lit = r() < (o.lit ?? 0.2);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = c.mute; ctx.lineWidth = 1;
    box(ctx, r, wx, wy, 12, 17, 1);
    ctx.globalAlpha = lit ? 0.4 : 0.22; ctx.lineWidth = 0.6;
    hatchRect(ctx, wx + 1, wy + 1, 10, 15, lit ? 2.2 : 3.6, lit ? 0.6 : -0.8);
    if (lit) { ctx.globalAlpha = 0.5; path(ctx, [{ x: wx - 1, y: wy + 17 }, { x: wx + 13, y: wy + 17 }]); ctx.stroke(); }
    else { ctx.globalAlpha = 0.3; path(ctx, [{ x: wx + 6, y: wy }, { x: wx + 6, y: wy + 17 }]); ctx.stroke(); }
  }
}

function fireEscape(ctx: Ctx, c: Colors, r: () => number, x: number, top: number, w: number, floors: number) {
  ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.4;
  for (let i = 0; i < floors; i++) {
    const y = top + i * 30;
    pline(ctx, r, { x: x - 4, y }, { x: x + w + 4, y }, 1.4);
    pline(ctx, r, { x: x - 4, y: y - 9 }, { x: x + w + 4, y: y - 9 }, 0.9);
    for (let px = x; px <= x + w; px += 7) pline(ctx, r, { x: px, y }, { x: px, y: y - 9 }, 0.5, 0.2);
    if (i < floors - 1) { // stair zigzag
      const dir = i % 2 ? 1 : -1, sx = dir > 0 ? x : x + w;
      pline(ctx, r, { x: sx, y }, { x: sx + dir * w * 0.8, y: y + 30 }, 1);
      pline(ctx, r, { x: sx + dir * 4, y }, { x: sx + dir * w * 0.8 + dir * 4, y: y + 30 }, 0.8);
    }
  }
}

function waterTower(ctx: Ctx, c: Colors, r: () => number, x: number, y: number) {
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.paper;
  // legs
  ctx.globalAlpha = 0.55;
  pline(ctx, r, { x: x - 16, y: y + 28 }, { x: x - 20, y: y + 58 }, 1.3);
  pline(ctx, r, { x: x + 16, y: y + 28 }, { x: x + 20, y: y + 58 }, 1.3);
  pline(ctx, r, { x: x - 17, y: y + 40 }, { x: x + 17, y: y + 52 }, 0.8);
  pline(ctx, r, { x: x + 17, y: y + 40 }, { x: x - 17, y: y + 52 }, 0.8);
  // barrel
  ctx.globalAlpha = 1; rect(ctx, x - 20, y, 40, 30); ctx.fill();
  ctx.globalAlpha = 0.6; box(ctx, r, x - 20, y, 40, 30, 1.4);
  ctx.globalAlpha = 0.3; ctx.lineWidth = 0.8;
  for (const t of [8, 20]) path(ctx, [{ x: x - 20, y: y + t }, { x: x + 20, y: y + t }]), ctx.stroke();
  hatchRect(ctx, x + 6, y, 14, 30, 3, -Math.PI / 4);
  // cone roof
  ctx.globalAlpha = 0.6; ctx.lineWidth = 1.3;
  path(ctx, [{ x: x - 23, y }, { x, y: y - 16 }, { x: x + 23, y }], true); ctx.fillStyle = c.paper; ctx.globalAlpha = 1; ctx.fill();
  ctx.globalAlpha = 0.6; ctx.stroke();
  ctx.globalAlpha = 0.25; ctx.lineWidth = 0.7; hatchRect(ctx, x, y - 16, 23, 16, 3, -Math.PI / 4);
}

function tree(ctx: Ctx, c: Colors, r: () => number, x: number, base: number) {
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.paper;
  ctx.globalAlpha = 0.6;
  pline(ctx, r, { x: x - 4, y: base }, { x: x - 3, y: base - 80 }, 2);
  pline(ctx, r, { x: x + 5, y: base }, { x: x + 4, y: base - 80 }, 2);
  pline(ctx, r, { x: x, y: base - 70 }, { x: x - 26, y: base - 110 }, 1.4);
  pline(ctx, r, { x: x, y: base - 70 }, { x: x + 28, y: base - 105 }, 1.4);
  const blobs: [number, number, number][] = [[0, -140, 34], [-30, -118, 26], [30, -118, 26], [-12, -108, 24], [14, -102, 22], [0, -165, 22]];
  for (const [dx, dy, rad] of blobs) {
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x + dx, base + dy, rad, 0, Math.PI * 2); ctx.fill();
  }
  for (const [dx, dy, rad] of blobs) {
    ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let a = 0; a <= 6.4; a += 0.45) { const rr = rad * (0.92 + r() * 0.18); const px = x + dx + Math.cos(a) * rr, py = base + dy + Math.sin(a) * rr; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
  }
  // leafy hatching, denser lower right
  ctx.globalAlpha = 0.24; ctx.lineWidth = 0.7;
  for (const [dx, dy, rad] of blobs) {
    ctx.beginPath(); ctx.arc(x + dx, base + dy, rad - 2, 0, Math.PI * 2);
    hatch(ctx, { x: x + dx - rad, y: base + dy - rad, w: rad * 2, h: rad * 2 }, 3.5, -Math.PI / 3);
  }
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 40; i++) { // leaf ticks
    const a = r() * 6.28, d = r() * 40, px = x + Math.cos(a) * d * 1.1, py = base - 135 + Math.sin(a) * d * 0.9;
    path(ctx, [{ x: px, y: py }, { x: px + 3, y: py + 2 }]); ctx.stroke();
  }
}

function tag(ctx: Ctx, c: Colors, x: number, y: number, text: string, rot: number, size: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.mute; ctx.globalAlpha = 0.32;
  ctx.font = `italic 800 ${size}px "Brush Script MT", "Comic Sans MS", cursive`;
  ctx.lineWidth = 1.2; ctx.strokeText(text, 0, 0); ctx.globalAlpha = 0.14; ctx.fillText(text, 0, 0);
  ctx.globalAlpha = 0.3; ctx.lineWidth = 1.5;
  const wd = ctx.measureText(text).width;
  ctx.beginPath(); ctx.moveTo(-2, size * 0.2); ctx.quadraticCurveTo(wd / 2, size * 0.35, wd + 4, size * 0.1); ctx.stroke();
  ctx.restore();
}

export function drawStreet(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE, r = seeded(11);
  ctx.save();
  // Golden-hour sky: long faint horizontal streaks near the horizon.
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7;
  for (let y = 120; y < base - 120; y += 5) {
    ctx.globalAlpha = 0.04 + ((y - 120) / 140) * 0.1;
    let x = r() * 200 - 100;
    while (x < W) { const l = 60 + r() * 160; path(ctx, [{ x, y }, { x: x + l, y }]); ctx.stroke(); x += l + 20 + r() * 80; }
  }
  // Far skyline: light outlines only.
  let x = -10;
  while (x < W) {
    const w = 46 + r() * 60, top = base - 150 - r() * 110 + (x > 380 && x < 600 ? 60 : 0);
    ctx.fillStyle = c.paper; ctx.strokeStyle = c.faint; ctx.globalAlpha = 1; rect(ctx, x, top, w, base - top); ctx.fill();
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1; rect(ctx, x, top, w, base - top); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.lineWidth = 0.6; hatchRect(ctx, x + w * 0.6, top, w * 0.4, base - top, 5, -Math.PI / 4);
    x += w + 2 + r() * 8;
  }
  // Water tower behind, on the skyline.
  waterTower(ctx, c, r, 368, base - 224);
  // Near buildings: brick on the left with a fire escape, a concrete block in the middle.
  building(ctx, c, r, 70, base - 235, 190, base, { brick: true, lit: 0.25 });
  fireEscape(ctx, c, r, 150, base - 205, 70, 4);
  building(ctx, c, r, 330, base - 150, 75, base, { lit: 0.2 });
  building(ctx, c, r, 590, base - 195, 170, base, { brick: true, lit: 0.18 });
  fireEscape(ctx, c, r, 700, base - 170, 46, 3);
  // low, calm shop front on the far right
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.faint; ctx.globalAlpha = 1; rect(ctx, 780, base - 130, 190, 130); ctx.fill();
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1; box(ctx, r, 780, base - 130, 190, 130, 1);
  ctx.globalAlpha = 0.2; ctx.lineWidth = 0.6; hatchRect(ctx, 780, base - 130, 190, 130, 7, -Math.PI / 4);
  ctx.strokeStyle = c.mute;
  // Graffiti tags in pencil on the brick.
  tag(ctx, c, 82, base - 160, 'RIM', -0.1, 26);
  tag(ctx, c, 620, base - 150, 'hoop', -0.06, 22);
  // Tree between the buildings, behind the fence.
  tree(ctx, c, r, 458, base - 20);
  // Power lines with a bird and a pair of hung sneakers.
  ctx.strokeStyle = c.mute; ctx.globalAlpha = 0.55;
  const wy = (y0: number, y1: number, sag: number, t: number): P => ({ x: 2 * (1 - t) * t * 480 + t * t * 780, y: (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag) + t * t * y1 });
  const wire = (y0: number, y1: number, sag: number) => {
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y0); ctx.quadraticCurveTo(480, (y0 + y1) / 2 + sag, 780, y1); ctx.stroke();
  };
  wire(96, 112, 40); wire(104, 124, 36);
  // sneakers
  const wp = wy(96, 112, 40, 0.3), sx = wp.x, sy = wp.y + 12;
  ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2; path(ctx, [{ x: sx, y: sy - 12 }, { x: sx - 2, y: sy + 8 }]); ctx.stroke();
  path(ctx, [{ x: sx + 6, y: sy - 12 }, { x: sx + 8, y: sy + 8 }]); ctx.stroke();
  for (const dx of [-8, 8]) {
    const px = sx + dx + 1, py = sy + 8;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1;
    path(ctx, [{ x: px - 8, y: py }, { x: px + 5, y: py }, { x: px + 11, y: py + 10 }, { x: px - 8, y: py + 10 }], true); ctx.fill();
    ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 0.4; path(ctx, [{ x: px - 7, y: py + 6 }, { x: px + 8, y: py + 6 }]); ctx.stroke();
  }
  // sitting bird on the lower wire
  {
    const wq = wy(104, 124, 36, 0.78), bx = wq.x, wy2 = wq.y;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(bx, wy2 - 6, 7, 5, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + 6, wy2 - 10, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    path(ctx, [{ x: bx - 6, y: wy2 - 7 }, { x: bx - 14, y: wy2 - 3 }]); ctx.stroke();
    path(ctx, [{ x: bx + 2, y: wy2 - 1 }, { x: bx + 2, y: wy2 + 1 }]); ctx.stroke();
  }
  // Chain-link fence along the back of the court.
  const top = base - 120;
  ctx.fillStyle = c.paper; ctx.globalAlpha = 0.5; rect(ctx, 0, top, W, base - top); ctx.fill();
  const tear = { x: 250, y: top + 40, w: 70, h: 52 };
  ctx.strokeStyle = c.ink; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.2;
  // mesh drawn in diamond hatch, skipping the torn patch
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, W, base - top); ctx.rect(tear.x, tear.y, tear.w, tear.h);
  ctx.clip('evenodd');
  for (const a of [Math.PI / 4, -Math.PI / 4]) { rect(ctx, 0, top, W, base - top); hatch(ctx, { x: 0, y: top, w: W, h: base - top }, 8, a); }
  ctx.restore();
  // torn patch: curled, bent wire ends and sagging mesh
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const px = tear.x + (i / 8) * tear.w, curl = 6 + r() * 10;
    ctx.beginPath(); ctx.moveTo(px, tear.y); ctx.bezierCurveTo(px + 3, tear.y + curl, px - 5, tear.y + curl + 4, px + 2, tear.y + curl + 9); ctx.stroke();
  }
  pline(ctx, r, { x: tear.x, y: tear.y }, { x: tear.x - 2, y: tear.y + tear.h }, 1.2);
  pline(ctx, r, { x: tear.x + tear.w, y: tear.y }, { x: tear.x + tear.w + 3, y: tear.y + tear.h }, 1.2);
  ctx.globalAlpha = 0.25; ctx.lineWidth = 0.6; // sagging diagonal
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(tear.x + 6, tear.y + 6 + i * 6); ctx.quadraticCurveTo(tear.x + tear.w / 2, tear.y + 24 + i * 6, tear.x + tear.w - 6, tear.y + 4 + i * 6); ctx.stroke(); }
  // rails and posts
  ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.6;
  pline(ctx, r, { x: 0, y: top }, { x: W, y: top }, 2.2);
  pline(ctx, r, { x: 0, y: top + 4 }, { x: W, y: top + 4 }, 1);
  pline(ctx, r, { x: 0, y: base - 3 }, { x: W, y: base - 3 }, 1.2);
  for (let px = 40; px < W; px += 150) {
    pline(ctx, r, { x: px - 2, y: top - 6 }, { x: px - 2, y: base }, 2.2);
    pline(ctx, r, { x: px + 2, y: top - 6 }, { x: px + 2, y: base }, 1.4);
    ctx.fillStyle = c.paper; ctx.beginPath(); ctx.arc(px, top - 8, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // sign zip-tied to the fence
  {
    const sx0 = 520, sy0 = top + 22;
    ctx.save(); ctx.translate(sx0, sy0); ctx.rotate(0.03);
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, 0, 0, 74, 40); ctx.fill();
    ctx.globalAlpha = 0.7; ctx.lineWidth = 1.4; rect(ctx, 0, 0, 74, 40); ctx.stroke();
    ctx.lineWidth = 0.7; rect(ctx, 4, 4, 66, 32); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.6; ctx.font = '700 9px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText('NO DUNKING', 37, 17); ctx.fillText('AFTER DARK', 37, 29);
    ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5; // zip ties
    for (const [zx, zy] of [[2, 2], [72, 2], [2, 38], [72, 38]]) path(ctx, [{ x: zx - 2, y: zy - 2 }, { x: zx + 3, y: zy + 3 }]), ctx.stroke();
    ctx.restore();
  }
  // Street lamp on the left, with a glow of hatching.
  ctx.strokeStyle = c.ink; ctx.fillStyle = c.paper; ctx.globalAlpha = 0.75;
  pline(ctx, r, { x: 16, y: base }, { x: 16, y: 74 }, 3.2);
  pline(ctx, r, { x: 21, y: base }, { x: 21, y: 74 }, 1.4);
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(19, 76); ctx.quadraticCurveTo(22, 54, 50, 56); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(23, 76); ctx.quadraticCurveTo(26, 59, 48, 61); ctx.stroke();
  path(ctx, [{ x: 40, y: 56 }, { x: 64, y: 56 }, { x: 60, y: 66 }, { x: 44, y: 66 }], true); ctx.globalAlpha = 1; ctx.fill();
  ctx.globalAlpha = 0.8; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.globalAlpha = 0.35; ctx.lineWidth = 0.7; hatchRect(ctx, 44, 57, 16, 8, 2, -Math.PI / 4);
  path(ctx, [{ x: 16, y: base - 40 }, { x: 24, y: base - 40 }, { x: 26, y: base }, { x: 12, y: base }], true); ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.stroke(); // base collar
  ctx.globalAlpha = 0.12; ctx.strokeStyle = c.mute; // light cone
  path(ctx, [{ x: 44, y: 67 }, { x: 60, y: 67 }, { x: 96, y: 150 }, { x: 8, y: 150 }], true); hatch(ctx, { x: 8, y: 67, w: 88, h: 83 }, 4, -1.1);
  ctx.restore();
}

/** Moving parts: drifting clouds, and a bird that crosses the sky now and then. */
export function drawStreetLive(ctx: Ctx, c: Colors, time: number): void {
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
    // underside hatching
    ctx.save(); ctx.globalAlpha = 0.3; ctx.lineWidth = 0.7;
    for (let k = 0; k < 5; k++) path(ctx, [{ x: x - 8 * s + k * 9 * s, y: y + 1 }, { x: x - 2 * s + k * 9 * s, y: y + 4 }]), ctx.stroke();
    ctx.restore();
  });
  // A bird: every 40 seconds, flapping across the sky.
  const T = 40, ph = (time % T) / T;
  if (ph < 0.3) {
    const bx = -20 + (ph / 0.3) * (W + 40), by = 150 + Math.sin(ph * 20) * 6, f = Math.sin(time * 9) * 5;
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(bx - 9, by - f); ctx.quadraticCurveTo(bx - 4, by - 4 - f, bx, by); ctx.quadraticCurveTo(bx + 4, by - 4 - f, bx + 9, by - f); ctx.stroke();
  }
  ctx.restore();
}
