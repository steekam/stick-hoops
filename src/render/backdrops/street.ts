import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, SCOREBOARD, seeded } from './common';

// Street: an outdoor court with a fence and a city behind it.

export function drawStreet(ctx: Ctx, c: Colors): void {
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

/** Moving parts: drifting clouds. */
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
  });
  ctx.restore();
}
