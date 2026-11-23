import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, seeded } from './common';

// Street: an outdoor court at golden hour, with two brick buildings, a chain-link fence and a lamp.

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
  // Near buildings: brick on the left with a fire escape, a concrete block in the middle.
  building(ctx, c, r, 70, base - 235, 190, base, { brick: true, lit: 0.25 });
  building(ctx, c, r, 590, base - 195, 170, base, { brick: true, lit: 0.18 });
  // low, calm shop front on the far right
  ctx.fillStyle = c.paper; ctx.strokeStyle = c.faint; ctx.globalAlpha = 1; rect(ctx, 780, base - 130, 190, 130); ctx.fill();
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1; box(ctx, r, 780, base - 130, 190, 130, 1);
  ctx.globalAlpha = 0.2; ctx.lineWidth = 0.6; hatchRect(ctx, 780, base - 130, 190, 130, 7, -Math.PI / 4);
  ctx.strokeStyle = c.mute;
  // Chain-link fence along the back of the court.
  const top = base - 120;
  ctx.fillStyle = c.paper; ctx.globalAlpha = 0.5; rect(ctx, 0, top, W, base - top); ctx.fill();
  ctx.strokeStyle = c.ink; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.2;
  // mesh drawn in diamond hatch
  ctx.save();
  ctx.beginPath(); ctx.rect(0, top, W, base - top);
  ctx.clip();
  for (const a of [Math.PI / 4, -Math.PI / 4]) { rect(ctx, 0, top, W, base - top); hatch(ctx, { x: 0, y: top, w: W, h: base - top }, 8, a); }
  ctx.restore();
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
  ctx.restore();
}

/** Moving parts: one drifting cloud. */
export function drawStreetLive(ctx: Ctx, c: Colors, time: number): void {
  ctx.save();
  ctx.strokeStyle = c.mute; ctx.fillStyle = c.paper; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
  [[120, 60, 1]].forEach(([x0, y, s], i) => {
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
  ctx.restore();
}
