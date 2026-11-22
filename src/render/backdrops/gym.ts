import { Ctx, Colors, hatch, path, rect, W, WALL_BASE, SCOREBOARD, seeded } from './common';

// Gym: a school gym seen from the court. Steel roof trusses with high-bay lamps, tall windows
// throwing light down and to the right, wooden bleachers on the left, padded wainscot, banners,
// a door with an exit sign. Drawn in pencil: always lighter than the gameplay layer.

type P = { x: number; y: number };

const WINDOWS = [44, 196, 640];
const WIN = { w: 104, top: 56, bot: 176 };
const LAMPS = [110, 300, 690, 880];
const LAMP_Y = 30;

/** A pencil stroke: a main line plus a fainter second pass slightly off it. */
function line(ctx: Ctx, color: string, a: P, b: P, w = 1, alpha = 1, rnd?: () => number) {
  const j = rnd ? () => (rnd() - 0.5) * 0.9 : () => 0;
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha = alpha;
  path(ctx, [{ x: a.x + j(), y: a.y + j() }, { x: b.x + j(), y: b.y + j() }]); ctx.stroke();
  if (rnd) {
    ctx.lineWidth = w * 0.5; ctx.globalAlpha = alpha * 0.45;
    path(ctx, [{ x: a.x + 0.8, y: a.y - 0.6 }, { x: b.x + 0.8, y: b.y - 0.6 }]); ctx.stroke();
  }
}

function dot(ctx: Ctx, color: string, x: number, y: number, r: number, alpha: number) {
  ctx.fillStyle = color; ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function drawGym(ctx: Ctx, c: Colors): void {
  const base = WALL_BASE;
  const rnd = seeded(7331);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // ---- Wall: painted cinder block, faint courses, shaded toward the right and under the roof. ----
  const BH = 22;
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.14;
  let row = 0;
  for (let y = base - 34; y > 40; y -= BH, row++) {
    path(ctx, [{ x: 0, y }, { x: W, y }]); ctx.stroke();
    for (let x = row % 2 ? 0 : 28; x < W; x += 56) { path(ctx, [{ x, y: y - BH }, { x, y }]); ctx.stroke(); }
  }
  // Roof shadow: hatching fading downward from the truss.
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7;
  for (let i = 0; i < 6; i++) {
    ctx.globalAlpha = 0.16 - i * 0.025;
    const y = 44 + i * 5;
    for (let x = -10 + (i % 2) * 6; x < W; x += 12) { path(ctx, [{ x, y }, { x: x + 9, y: y + 5 }]); ctx.stroke(); }
  }

  // ---- Light beams from the windows (upper left light), falling down and to the right. ----
  for (const wx of WINDOWS) {
    const { w, bot } = WIN;
    const shift = 120;
    const beam = [{ x: wx, y: bot }, { x: wx + w, y: bot }, { x: wx + w + shift, y: base + 40 }, { x: wx + shift, y: base + 40 }];
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.09;
    path(ctx, beam, true); hatch(ctx, { x: wx, y: bot, w: w + shift, h: base + 40 - bot }, 8, -1.0);
    ctx.globalAlpha = 0.07;
    path(ctx, beam, true); hatch(ctx, { x: wx, y: bot, w: w + shift, h: base + 40 - bot }, 16, -0.2);
    line(ctx, c.mute, beam[0], beam[3], 0.8, 0.2);
    line(ctx, c.mute, beam[1], beam[2], 0.8, 0.2);
  }

  // ---- Roof trusses: two chords, Warren diagonals, verticals, rivets, a purlin and a gusset plate. ----
  const topY = 5, botY = 30;
  ctx.fillStyle = c.paper; ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, W, botY + 4);
  line(ctx, c.ink, { x: 0, y: topY }, { x: W, y: topY }, 2.2, 0.5, rnd);
  line(ctx, c.ink, { x: 0, y: topY + 3.5 }, { x: W, y: topY + 3.5 }, 0.8, 0.3);
  line(ctx, c.ink, { x: 0, y: botY }, { x: W, y: botY }, 2.4, 0.5, rnd);
  line(ctx, c.ink, { x: 0, y: botY + 3.5 }, { x: W, y: botY + 3.5 }, 0.8, 0.3);
  const bay = 48;
  for (let x = 0; x <= W + bay; x += bay) {
    line(ctx, c.mute, { x, y: topY }, { x: x + bay / 2, y: botY }, 1.1, 0.6, rnd);
    line(ctx, c.mute, { x: x + bay / 2, y: botY }, { x: x + bay, y: topY }, 1.1, 0.6, rnd);
    line(ctx, c.mute, { x, y: topY }, { x, y: botY }, 1.4, 0.55, rnd);
    for (const p of [{ x, y: topY }, { x: x + bay / 2, y: botY }]) {
      dot(ctx, c.ink, p.x, p.y, 1.7, 0.5);
    }
  }
  // Shading under the lower chord.
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.22;
  for (let x = 0; x < W; x += 5) { path(ctx, [{ x, y: botY + 4 }, { x: x + 3, y: botY + 9 }]); ctx.stroke(); }
  // Cross-bracing rods between the two outermost bays, and a vertical hanger rod set.
  ctx.globalAlpha = 1;

  // ---- High-bay lamps hanging from the truss, each with a hatched cone of light. ----
  for (const lx of LAMPS) {
    line(ctx, c.ink, { x: lx, y: botY + 4 }, { x: lx, y: LAMP_Y + 6 }, 1, 0.5);
    // cone
    const cone = [{ x: lx - 14, y: LAMP_Y + 18 }, { x: lx + 14, y: LAMP_Y + 18 }, { x: lx + 56, y: 150 }, { x: lx - 56, y: 150 }];
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.1;
    path(ctx, cone, true); hatch(ctx, { x: lx - 56, y: LAMP_Y + 18, w: 112, h: 132 }, 6, -Math.PI / 2 + 0.5);
    line(ctx, c.mute, cone[0], cone[3], 0.7, 0.14);
    line(ctx, c.mute, cone[1], cone[2], 0.7, 0.14);
    // shade (dome) with a lit left side and a hatched right side
    const dome = () => {
      ctx.beginPath(); ctx.moveTo(lx - 15, LAMP_Y + 18);
      ctx.quadraticCurveTo(lx - 15, LAMP_Y + 4, lx, LAMP_Y + 4);
      ctx.quadraticCurveTo(lx + 15, LAMP_Y + 4, lx + 15, LAMP_Y + 18); ctx.closePath();
    };
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; dome(); ctx.fill();
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.5;
    dome(); hatch(ctx, { x: lx, y: LAMP_Y + 4, w: 15, h: 14 }, 2.6, -1.0);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65; dome(); ctx.stroke();
    line(ctx, c.ink, { x: lx - 17, y: LAMP_Y + 18 }, { x: lx + 17, y: LAMP_Y + 18 }, 1.6, 0.65);
    line(ctx, c.mute, { x: lx - 11, y: LAMP_Y + 22 }, { x: lx + 11, y: LAMP_Y + 22 }, 1, 0.4);
  }

  // ---- Windows: frames with reveal, mullions, panes hatched where sky is dim, sill. ----
  for (const wx of WINDOWS) {
    const { w, top, bot } = WIN, h = bot - top;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, wx - 5, top - 5, w + 10, h + 10); ctx.fill();
    // glass: paper, with light diagonal hatching in the upper panes
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.28;
    rect(ctx, wx, top, w, 40); hatch(ctx, { x: wx, y: top, w, h: 40 }, 6, -0.95);
    ctx.globalAlpha = 0.14;
    rect(ctx, wx, top + 40, w, h - 40); hatch(ctx, { x: wx, y: top + 40, w, h: h - 40 }, 11, -0.95);
    // reveal shadow on the left jamb & top (light from upper left lands on the right/bottom edges)
    ctx.globalAlpha = 0.4; ctx.lineWidth = 0.6;
    path(ctx, [{ x: wx, y: top }, { x: wx + 6, y: top + 5 }, { x: wx + 6, y: bot - 0 }, { x: wx, y: bot }], true);
    hatch(ctx, { x: wx, y: top, w: 6, h }, 2.5, 0.9);
    // frames
    line(ctx, c.ink, { x: wx - 5, y: top - 5 }, { x: wx + w + 5, y: top - 5 }, 2.2, 0.6, rnd);
    line(ctx, c.ink, { x: wx + w + 5, y: top - 5 }, { x: wx + w + 5, y: bot + 5 }, 2.2, 0.6, rnd);
    line(ctx, c.ink, { x: wx + w + 5, y: bot + 5 }, { x: wx - 5, y: bot + 5 }, 2.2, 0.6, rnd);
    line(ctx, c.ink, { x: wx - 5, y: bot + 5 }, { x: wx - 5, y: top - 5 }, 2.2, 0.6, rnd);
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.45; rect(ctx, wx, top, w, h); ctx.stroke();
    // mullions & transom
    for (let i = 1; i < 4; i++) line(ctx, c.ink, { x: wx + (w * i) / 4, y: top }, { x: wx + (w * i) / 4, y: bot }, 1.3, 0.55, rnd);
    line(ctx, c.ink, { x: wx, y: top + 40 }, { x: wx + w, y: top + 40 }, 1.6, 0.55, rnd);
    line(ctx, c.ink, { x: wx, y: top + 82 }, { x: wx + w, y: top + 82 }, 1.1, 0.45, rnd);
    // a tilted vent pane (opening hopper)
    ctx.strokeStyle = c.ink; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.5;
    path(ctx, [{ x: wx + 2 * w / 4 + 3, y: top + 40 + 3 }, { x: wx + 3 * w / 4 - 3, y: top + 40 + 3 }, { x: wx + 3 * w / 4 - 6, y: top + 82 - 3 }, { x: wx + 2 * w / 4 + 6, y: top + 82 - 3 }], true); ctx.stroke();
    // wire-glass cage hint: faint reflection streaks (lit upper left)
    line(ctx, c.faint, { x: wx + 8, y: top + 10 }, { x: wx + 22, y: top + 32 }, 1.2, 0.5);
    line(ctx, c.faint, { x: wx + 12, y: top + 6 }, { x: wx + 28, y: top + 30 }, 0.8, 0.4);
    // sill: thick slab with shade beneath
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, wx - 9, bot + 5, w + 18, 6); ctx.fill();
    line(ctx, c.ink, { x: wx - 9, y: bot + 11 }, { x: wx + w + 9, y: bot + 11 }, 1.8, 0.6, rnd);
    line(ctx, c.ink, { x: wx - 9, y: bot + 5 }, { x: wx + w + 9, y: bot + 5 }, 1, 0.45);
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.3;
    for (let x = wx - 6; x < wx + w + 8; x += 4) { path(ctx, [{ x, y: bot + 12 }, { x: x + 3, y: bot + 18 }]); ctx.stroke(); }
  }

  // ---- Padded wainscot along the bottom of the wall: panels with seams, buttons, shaded seams. ----
  const wy = base - 34;
  ctx.fillStyle = c.paper; ctx.globalAlpha = 1; ctx.fillRect(0, wy, W, 34);
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6;
  for (let px = 0; px < W; px += 48) {
    ctx.globalAlpha = 0.3;
    rect(ctx, px + 2, wy + 4, 44, 28); hatch(ctx, { x: px + 2, y: wy + 4, w: 44, h: 28 }, 4.5, -0.9);
    // lit top-left edge, darker bottom-right
    line(ctx, c.faint, { x: px + 4, y: wy + 6 }, { x: px + 20, y: wy + 6 }, 1.5, 0.7);
    line(ctx, c.ink, { x: px + 46, y: wy + 6 }, { x: px + 46, y: wy + 31 }, 1.2, 0.3);
    line(ctx, c.ink, { x: px + 2, y: wy + 32 }, { x: px + 46, y: wy + 32 }, 1.2, 0.3);
    line(ctx, c.ink, { x: px, y: wy }, { x: px, y: base }, 1, 0.4, rnd);
  }
  line(ctx, c.ink, { x: 0, y: wy }, { x: W, y: wy }, 1.8, 0.55, rnd);
  line(ctx, c.ink, { x: 0, y: wy + 3 }, { x: W, y: wy + 3 }, 0.7, 0.3);
  line(ctx, c.ink, { x: 0, y: base - 1 }, { x: W, y: base - 1 }, 1.8, 0.55, rnd);

  // ---- Retractable bleachers along the left: stacked tiers, board seams, railing, support posts. ----
  const tiers = 5, th = 17;
  const topTierY = base - 34 - tiers * th + 34; // tiers sit on the floor line
  for (let i = 0; i < tiers; i++) {
    const y = base - (i + 1) * th - (i === 0 ? 0 : 0), x1 = 372 - i * 20;
    const bTop = y, bBot = y + th;
    // riser face (paper, blocks the wall)
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, 0, bTop, x1, th); ctx.fill();
    // plank seats: a thick seat board + riser face hatched
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.34;
    rect(ctx, 0, bTop + 5, x1, th - 5); hatch(ctx, { x: 0, y: bTop + 5, w: x1, h: th - 5 }, 3.6, -0.15);
    ctx.globalAlpha = 0.5; ctx.lineWidth = 0.7;
    // wood grain on seat board
    for (let g = 0; g < 4; g++) {
      const gx = rnd() * x1, gl = 20 + rnd() * 40;
      path(ctx, [{ x: gx, y: bTop + 2.5 }, { x: Math.min(x1, gx + gl), y: bTop + 2.5 }]); ctx.stroke();
    }
    // plank ends every 56 units (vertical seams)
    ctx.globalAlpha = 0.38;
    for (let x = 28 + (i % 2) * 20; x < x1; x += 56) { path(ctx, [{ x, y: bTop }, { x, y: bTop + 5 }]); ctx.stroke(); }
    line(ctx, c.ink, { x: 0, y: bTop }, { x: x1, y: bTop }, 2.2, 0.62, rnd);
    line(ctx, c.ink, { x: 0, y: bTop + 5 }, { x: x1, y: bTop + 5 }, 1, 0.42, rnd);
    line(ctx, c.ink, { x: x1, y: bTop }, { x: x1, y: bBot }, 1.4, 0.6, rnd);
    // shadow cast under each seat (hatch) onto the riser
    ctx.strokeStyle = c.ink; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.25;
    for (let x = 2; x < x1; x += 4) { path(ctx, [{ x, y: bTop + 6 }, { x: x + 2, y: bTop + 10 }]); ctx.stroke(); }
    // vertical steel supports every 90 units
    for (let x = 44; x < x1; x += 90) line(ctx, c.mute, { x, y: bTop + 5 }, { x, y: bBot }, 1.6, 0.5);
    // folded end: the tier's end cap dips and shows its thickness
    if (i === tiers - 1) {
      line(ctx, c.ink, { x: x1, y: bTop }, { x: x1 + 6, y: bTop - 4 }, 1, 0.45);
    }
  }
  // Handrail on the top tier: posts and a double rail.
  {
    const i = tiers - 1, y = base - (i + 1) * th, x1 = 372 - i * 20;
    line(ctx, c.ink, { x: 0, y: y - 22 }, { x: x1, y: y - 22 }, 1.5, 0.55, rnd);
    line(ctx, c.ink, { x: 0, y: y - 11 }, { x: x1, y: y - 11 }, 0.9, 0.4, rnd);
    for (let x = 14; x < x1; x += 58) line(ctx, c.ink, { x, y: y - 22 }, { x, y }, 1.2, 0.5);
    ctx.fillStyle = c.paper;
  }
  // Rail on the stairs side (diagonal handrail down the right end of the tiers).
  line(ctx, c.ink, { x: 372, y: base - 6 }, { x: 292, y: base - tiers * th - 6 }, 1.2, 0.35, rnd);
  for (let i = 0; i < tiers; i++) {
    const x = 372 - i * 20 - 2, y = base - i * th - 6;
    line(ctx, c.ink, { x, y }, { x, y: y - 10 }, 0.9, 0.3);
  }
  // Folded-up tier at the far end of the stack, suggesting retraction mechanism: a wheel.
  void topTierY;

  // ---- Door with an exit sign above it, middle of the wall. ----
  {
    const dx = 452, dw = 62, dtop = base - 122;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, dx - 6, dtop - 6, dw + 12, base - dtop - 34 + 6); ctx.fill();
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.3;
    rect(ctx, dx, dtop, dw, base - dtop - 34); hatch(ctx, { x: dx, y: dtop, w: dw, h: base - dtop }, 5, 0.9);
    // double door
    line(ctx, c.ink, { x: dx, y: dtop }, { x: dx + dw, y: dtop }, 2, 0.6, rnd);
    line(ctx, c.ink, { x: dx, y: dtop }, { x: dx, y: base - 34 }, 2, 0.6, rnd);
    line(ctx, c.ink, { x: dx + dw, y: dtop }, { x: dx + dw, y: base - 34 }, 2, 0.6, rnd);
    line(ctx, c.ink, { x: dx + dw / 2, y: dtop }, { x: dx + dw / 2, y: base - 34 }, 1.2, 0.5);
    // frame
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.4; rect(ctx, dx - 5, dtop - 5, dw + 10, base - dtop + 5 - 34); ctx.stroke();
    // door windows & push bars
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    rect(ctx, dx + 8, dtop + 10, 14, 30); ctx.stroke(); rect(ctx, dx + dw / 2 + 9, dtop + 10, 14, 30); ctx.stroke();
    line(ctx, c.ink, { x: dx + 4, y: dtop + 62 }, { x: dx + dw / 2 - 4, y: dtop + 62 }, 1.8, 0.6);
    line(ctx, c.ink, { x: dx + dw / 2 + 4, y: dtop + 62 }, { x: dx + dw - 4, y: dtop + 62 }, 1.8, 0.6);
    // exit sign
    const sx = dx + dw / 2 - 22, sy = dtop - 26;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, sx, sy, 44, 15); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.65; rect(ctx, sx, sy, 44, 15); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.6; ctx.font = '700 10px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('EXIT', sx + 22, sy + 11.5);
    // a little arrow
    ctx.textAlign = 'left';
    line(ctx, c.ink, { x: sx + 4, y: sy + 8 }, { x: sx + 9, y: sy + 8 }, 1, 0.5);
    line(ctx, c.ink, { x: sx + 34, y: sy + 1 }, { x: sx + 34, y: sy - 8 }, 1, 0.4);
  }

  // ---- Wall clock, fire alarm, water fountain, vent. ----
  {
    const cx = 598, cy = 130, r = 15;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 7); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.lineWidth = 0.7; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(cx + 0.8, cy - 0.6, r + 0.8, 0.3, 5.6); ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6, r1 = r - (i % 3 ? 2.5 : 4.5);
      path(ctx, [{ x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 }, { x: cx + Math.cos(a) * (r - 1.5), y: cy + Math.sin(a) * (r - 1.5) }]); ctx.stroke();
    }
    line(ctx, c.ink, { x: cx, y: cy }, { x: cx + 6, y: cy - 6 }, 1.6, 0.65);
    line(ctx, c.ink, { x: cx, y: cy }, { x: cx - 2, y: cy + 9 }, 1.1, 0.6);
    dot(ctx, c.ink, cx, cy, 1.3, 0.7);
    // fire alarm
    const ax = 540, ay = 200;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, ax, ay, 12, 18); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.55; rect(ctx, ax, ay, 12, 18); ctx.stroke();
    line(ctx, c.ink, { x: ax + 2, y: ay + 8 }, { x: ax + 10, y: ay + 8 }, 1.5, 0.5);
    dot(ctx, c.ink, ax + 6, ay + 4, 1.4, 0.45);
    // vent grille high on the wall
    const vx = 318, vy = 128;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, vx, vy, 46, 20); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.5; rect(ctx, vx, vy, 46, 20); ctx.stroke();
    for (let i = 1; i < 6; i++) line(ctx, c.mute, { x: vx + 3, y: vy + i * 3.2 }, { x: vx + 43, y: vy + i * 3.2 - 1 }, 0.9, 0.5);
    // water fountain on the wall, right of the door
    const fx = 560, fy = base - 74;
    ctx.fillStyle = c.paper; ctx.globalAlpha = 1; rect(ctx, fx, fy, 30, 16); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.55; rect(ctx, fx, fy, 30, 16); ctx.stroke();
    ctx.strokeStyle = c.mute; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.35; rect(ctx, fx + 1, fy + 8, 28, 8); hatch(ctx, { x: fx + 1, y: fy + 8, w: 28, h: 8 }, 3, -0.9);
    path(ctx, [{ x: fx + 8, y: fy - 5 }, { x: fx + 8, y: fy }]); ctx.strokeStyle = c.ink; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.55; ctx.stroke();
    path(ctx, [{ x: fx + 5, y: fy - 5 }, { x: fx + 11, y: fy - 5 }]); ctx.stroke();
    line(ctx, c.ink, { x: fx + 6, y: fy + 16 }, { x: fx + 6, y: base - 34 }, 1.2, 0.4);
    line(ctx, c.ink, { x: fx + 24, y: fy + 16 }, { x: fx + 24, y: base - 34 }, 1.2, 0.4);
  }

  // ---- Banners & retired jerseys hanging from the truss on strings. Blue is the only colour. ----
  const banner = (x: number, y: number, w: number, h: number, label: string, size = 18) => {
    const shape = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x: x + w / 2, y: y + h - 12 }, { x, y: y + h }];
    // hanger strings to the lower truss chord
    line(ctx, c.ink, { x: x + 4, y: botY + 4 }, { x: x + 4, y }, 0.8, 0.5);
    line(ctx, c.ink, { x: x + w - 4, y: botY + 4 }, { x: x + w - 4, y }, 0.8, 0.5);
    ctx.globalAlpha = 0.9; ctx.fillStyle = c.paint; path(ctx, shape, true); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.22;
    path(ctx, shape, true); hatch(ctx, { x, y, w, h }, 5, -0.9);
    // heavier fold shadow on the right third
    ctx.globalAlpha = 0.3; path(ctx, [{ x: x + w * 0.7, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x: x + w / 2, y: y + h - 12 }, { x: x + w * 0.7, y: y + h - 15 }], true);
    hatch(ctx, { x: x + w * 0.7, y, w: w * 0.3, h }, 3.4, 0.9);
    // sewn border
    ctx.setLineDash([3, 3]); ctx.globalAlpha = 0.45; ctx.lineWidth = 0.8;
    path(ctx, [{ x: x + 4, y: y + 4 }, { x: x + w - 4, y: y + 4 }, { x: x + w - 4, y: y + h - 14 }, { x: x + w / 2, y: y + h - 22 }, { x: x + 4, y: y + h - 14 }], true); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = c.ink; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.8; path(ctx, shape, true); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.8; ctx.font = `800 ${size}px ui-monospace, Menlo, Consolas, monospace`; ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h * 0.5 + 4); ctx.textAlign = 'left';
    // pennant stars
    for (let s = 0; s < 3; s++) dot(ctx, c.ink, x + w / 2 - 10 + s * 10, y + 14, 1.5, 0.65);
  };
  banner(796, 36, 50, 82, 'B');
  banner(860, 36, 50, 82, '24');
  banner(748, 36, 36, 62, '09', 14);

  // Retired jerseys, pinned flat beside the vent and between the windows.
  const jersey = (x: number, y: number, num: string) => {
    line(ctx, c.ink, { x: x + 8, y: botY + 4 }, { x: x + 8, y: y + 2 }, 0.8, 0.5);
    line(ctx, c.ink, { x: x + 28, y: botY + 4 }, { x: x + 28, y: y + 2 }, 0.8, 0.5);
    const s = [{ x: x + 2, y }, { x: x + 11, y }, { x: x + 18, y: y + 10 }, { x: x + 25, y }, { x: x + 34, y }, { x: x + 38, y: y + 12 }, { x: x + 33, y: y + 18 }, { x: x + 33, y: y + 54 }, { x: x + 3, y: y + 54 }, { x: x + 3, y: y + 18 }, { x, y: y + 12 }];
    ctx.fillStyle = c.paint; ctx.globalAlpha = 0.9; path(ctx, s, true); ctx.fill();
    ctx.strokeStyle = c.ink; ctx.lineWidth = 0.6; ctx.globalAlpha = 0.22; path(ctx, s, true); hatch(ctx, { x, y, w: 38, h: 54 }, 4, -0.9);
    ctx.lineWidth = 1.7; ctx.globalAlpha = 0.75; path(ctx, s, true); ctx.stroke();
    ctx.fillStyle = c.ink; ctx.globalAlpha = 0.75; ctx.font = '800 16px ui-monospace, Menlo, Consolas, monospace'; ctx.textAlign = 'center';
    ctx.fillText(num, x + 18, y + 36); ctx.textAlign = 'left';
  };
  jersey(318, 40, '4');
  // second jersey sits left of the scoreboard cables (x 405+): fine.
  void SCOREBOARD;

  // Roof support: cross-bracing diagonals between the lower chord and a mid purlin along the far sides.
  ctx.globalAlpha = 1;
}

/** Moving parts: the lamps' subtle glow breathes and a few dust motes drift through the window light. */
export function drawGymLive(ctx: Ctx, c: Colors, time: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  // Lamp glow: a faint arc under each lamp, flickering very slightly.
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.8;
  LAMPS.forEach((lx, i) => {
    const f = 0.16 + 0.05 * Math.sin(time * 1.7 + i * 2.1) + 0.03 * Math.sin(time * 6.3 + i);
    ctx.globalAlpha = f;
    ctx.beginPath(); ctx.arc(lx, LAMP_Y + 20, 22, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.globalAlpha = f * 0.6;
    ctx.beginPath(); ctx.arc(lx, LAMP_Y + 20, 32, 0.45, Math.PI - 0.45); ctx.stroke();
  });
  // Dust motes drifting down-right inside the window beams.
  ctx.fillStyle = c.mute;
  for (let i = 0; i < 14; i++) {
    const wx = WINDOWS[i % 3];
    const ph = (time * (0.018 + (i % 5) * 0.004) + i * 0.173) % 1; // 0..1 down the beam
    const y = WIN.bot + ph * (WALL_BASE - WIN.bot);
    const x = wx + 10 + ((i * 37) % 84) + ph * 100 + Math.sin(time * 0.8 + i * 1.9) * 5;
    if (x > 770 && y > 180) continue; // keep the hoop area calm
    ctx.globalAlpha = 0.28 * Math.sin(ph * Math.PI);
    ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
