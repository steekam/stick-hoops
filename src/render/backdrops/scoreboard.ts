import { Ctx, Colors, hatch, path, rect } from './common';

// The scoreboard hanging over the court. Drawn every frame, on top of any backdrop.
// A centre-hung arena box in pencil: truss to the ceiling, steel frame, hatched underside, and a
// 7-segment LED readout. Own geometry (a little wider than common.SCOREBOARD).

export interface ScoreLines { big: string; small: string; label: string }

const BX = 385, BY = 20, BW = 210, BH = 90, DEPTH = 5;

// Last big value, for the brief "score changed" flash.
let lastBig = '';
let changedAt = -1e9;

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
}

// 5x7 dot-matrix font, one hex byte per row (bit 4 = leftmost column).
const FONT_SRC: Record<string, string> = {
  '0': '0E 11 13 15 19 11 0E', '1': '04 0C 04 04 04 04 0E', '2': '0E 11 01 02 04 08 1F', '3': '1F 02 04 02 01 11 0E',
  '4': '02 06 0A 12 1F 02 02', '5': '1F 10 1E 01 01 11 0E', '6': '06 08 10 1E 11 11 0E', '7': '1F 01 02 04 08 08 08',
  '8': '0E 11 11 0E 11 11 0E', '9': '0E 11 11 0F 01 02 0C',
  A: '0E 11 11 1F 11 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E', D: '1E 11 11 11 11 11 1E',
  E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10', G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11',
  I: '0E 04 04 04 04 04 0E', J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11', N: '11 11 19 15 13 11 11', O: '0E 11 11 11 11 11 0E', P: '1E 11 11 1E 10 10 10',
  Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11', S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0E', V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
  Y: '11 11 0A 04 04 04 04', Z: '1F 01 02 04 08 10 1F',
  ' ': '00 00 00 00 00 00 00', '/': '01 01 02 04 08 10 10', '\u00b7': '00 00 00 04 00 00 00', '\u00d7': '00 11 0A 04 0A 11 00',
  ':': '00 0C 0C 00 0C 0C 00', '.': '00 00 00 00 00 0C 0C', '-': '00 00 00 1F 00 00 00', '+': '00 04 04 1F 04 04 00',
  '%': '18 19 02 04 08 13 03', '\u25cf': '00 0E 1F 1F 1F 0E 00', '\u25cb': '00 0E 11 11 11 0E 00', '\u2026': '00 00 00 00 00 00 15',
  ',': '00 00 00 00 0C 04 08', '!': '04 04 04 04 04 00 04', '?': '0E 11 01 02 04 00 04', '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08', "'": '04 04 08 00 00 00 00', '=': '00 00 1F 00 1F 00 00',
};
const FONT: Record<string, number[]> = {};
for (const k in FONT_SRC) FONT[k] = FONT_SRC[k].split(' ').map(h => parseInt(h, 16));
const UNKNOWN = FONT['?'];

// Display geometry, relative to the LED window: dot grids for the score (centred, or nudged up when a clock sits below it) and the clock.
const WX = BX + 9, WY = BY + 8, WW = BW - 18, WH = BH - 16;
interface Grid { cols: number; pitch: number; r: number; y: number }
const G_BIG: Grid = { cols: 41, pitch: 4.3, r: 1.7, y: WY + 22 };
const G_BIG_UP: Grid = { ...G_BIG, y: WY + 17 }; // nudged up when a clock sits below the score
const G_SMALL: Grid = { cols: 104, pitch: 1.75, r: 0.72, y: WY + WH - 4 - 6 * 1.75 };
const gx = (g: Grid) => WX + (WW - (g.cols - 1) * g.pitch) / 2;

// The unlit grid never changes, so it is baked once per theme into an offscreen canvas.
const BAKE = 3;
const ghosts: Record<string, { cv: HTMLCanvasElement; key: string }> = {};
function bakeGhost(c: Colors, withClock: boolean): HTMLCanvasElement | null {
  const name = withClock ? 'clock' : 'score';
  const hit = ghosts[name];
  if (hit && hit.key === c.faint) return hit.cv;
  if (typeof document === 'undefined') return null;
  const ghost = hit?.cv ?? document.createElement('canvas');
  ghost.width = WW * BAKE; ghost.height = WH * BAKE;
  const g = ghost.getContext('2d');
  if (!g) return null;
  g.scale(BAKE, BAKE); g.translate(-WX, -WY);
  g.lineCap = 'round'; g.strokeStyle = c.faint; g.globalAlpha = 0.35;
  for (const gr of withClock ? [G_BIG_UP, G_SMALL] : [G_BIG]) {
    g.lineWidth = gr.r * 2; g.beginPath();
    const x0 = gx(gr);
    for (let row = 0; row < 7; row++) for (let col = 0; col < gr.cols; col++) {
      const x = x0 + col * gr.pitch, y = gr.y + row * gr.pitch; g.moveTo(x, y); g.lineTo(x + 0.01, y);
    }
    g.stroke();
  }
  ghosts[name] = { cv: ghost, key: c.faint };
  return ghost;
}

/** Lit dots of `text` on grid `g`, centred, as one path. The caller strokes it. */
function dotsPath(ctx: Ctx, g: Grid, text: string, maxChars: number) {
  const chars = text.length > maxChars ? text.slice(0, maxChars - 1) + '\u2026' : text;
  const n = chars.length;
  const span = n * 6 - 1;
  const off = Math.floor((g.cols - span) / 2);
  const x0 = gx(g);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const glyph = FONT[chars[i]] || UNKNOWN;
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      if (!bits) continue;
      const y = g.y + row * g.pitch;
      for (let col = 0; col < 5; col++) {
        if (bits & (16 >> col)) { const x = x0 + (off + i * 6 + col) * g.pitch; ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); }
      }
    }
  }
}

function drawDots(ctx: Ctx, g: Grid, text: string, maxChars: number, color: string, boost = 0) {
  if (!text) return;
  dotsPath(ctx, g, text, maxChars);
  ctx.strokeStyle = color;
  if (boost > 0) { ctx.lineWidth = g.r * 2 + 3; ctx.globalAlpha = 0.3 * boost; ctx.stroke(); }
  ctx.lineWidth = g.r * 2; ctx.globalAlpha = 1; ctx.stroke();
}

const CLOCK = /^\d:\d\d( \u00b7 \u00d7\d+)?$/;

/** A scoreboard hanging from the ceiling: the score in orange digits, and the clock in timed play. */
export function drawScoreboard(ctx: Ctx, c: Colors, s: ScoreLines): void {
  const now = performance.now();
  const big = (s.big || '').trim().slice(0, 7);
  // Only the score, plus the 60 Seconds clock ("0:42", "0:42 · ×2"). Anything longer would be
  // truncated and only repeats the HUD, so it is not shown.
  const clock = CLOCK.test(s.small) ? s.small : '';
  if (big !== lastBig) { if (lastBig !== '') changedAt = now; lastBig = big; }
  const age = now - changedAt;
  const boost = age < 700 ? 1 - age / 700 : 0;

  const x0 = BX, y0 = BY, w = BW, h = BH, bot = y0 + h, cx = x0 + w / 2;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // Trusses: two ladder rails with zig-zag bracing, from the ceiling to the top of the box.
  ctx.strokeStyle = c.ink; ctx.fillStyle = c.paper;
  for (const tx of [x0 + 36, x0 + w - 36]) {
    ctx.globalAlpha = 0.9; ctx.lineWidth = 1.5;
    ctx.beginPath(); line(ctx, tx - 3, 0, tx - 3, y0); line(ctx, tx + 3, 0, tx + 3, y0); ctx.stroke();
    ctx.globalAlpha = 0.6; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(tx - 3, 0);
    for (let k = 1, yy = 6; yy <= y0; k++, yy += 6) ctx.lineTo(tx + (k % 2 ? 3 : -3), yy);
    ctx.stroke();
    // Ceiling mount plate and a clamp where the truss meets the box.
    ctx.globalAlpha = 1; ctx.lineWidth = 1.6;
    rect(ctx, tx - 8, 0, 16, 4); ctx.fill(); ctx.stroke();
    rect(ctx, tx - 7, y0 - 5, 14, 5); ctx.fill(); ctx.stroke();
  }
  // A slack safety cable between the trusses.
  ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0 + 44, 3); ctx.quadraticCurveTo(cx, 16, x0 + w - 44, 3); ctx.stroke();

  // Underside (we look up at it): a trapezoid, hatched.
  const under = [{ x: x0, y: bot }, { x: x0 + w, y: bot }, { x: x0 + w - 9, y: bot + DEPTH }, { x: x0 + 9, y: bot + DEPTH }];
  ctx.globalAlpha = 1; ctx.fillStyle = c.paper; path(ctx, under, true); ctx.fill();
  ctx.strokeStyle = c.mute; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.75;
  path(ctx, under, true); hatch(ctx, { x: x0, y: bot, w, h: DEPTH }, 2.6, -0.9);

  // Front face.
  ctx.globalAlpha = 1; ctx.fillStyle = c.paper; rect(ctx, x0, y0, w, h); ctx.fill();
  // Steel frame, drawn twice with a slight offset like a pencil going over it again.
  ctx.strokeStyle = c.ink; ctx.lineWidth = 2.4; rect(ctx, x0, y0, w, h); ctx.stroke();
  ctx.lineWidth = 1; ctx.globalAlpha = 0.55; rect(ctx, x0 + 0.8, y0 - 0.7, w - 0.4, h + 0.9); ctx.stroke();
  ctx.globalAlpha = 1; ctx.lineWidth = 2; path(ctx, under, true); ctx.stroke();
  // Bevel: inner frame line plus rivets in the corners.
  ctx.lineWidth = 1; ctx.strokeStyle = c.mute; rect(ctx, x0 + 4, y0 + 4, w - 8, h - 8); ctx.stroke();
  ctx.fillStyle = c.mute;
  ctx.beginPath();
  for (const [rx, ry] of [[x0 + 2, y0 + 2], [x0 + w - 2, y0 + 2], [x0 + 2, bot - 2], [x0 + w - 2, bot - 2]]) { ctx.moveTo(rx + 0.8, ry); ctx.arc(rx, ry, 0.8, 0, Math.PI * 2); }
  ctx.fill();
  // Vent slots on the underside.
  ctx.strokeStyle = c.ink; ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (let vx = x0 + 40; vx <= x0 + w - 40; vx += 14) line(ctx, vx, bot + 2, vx - 1, bot + DEPTH - 1.5);
  ctx.stroke();

  // LED window with its baked ghost grid, then the lit dots.
  ctx.globalAlpha = 1; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.5; ctx.fillStyle = c.paper;
  rect(ctx, WX, WY, WW, WH); ctx.fill(); ctx.stroke();
  const gh = bakeGhost(c, !!clock);
  if (gh) ctx.drawImage(gh, WX, WY, WW, WH);
  ctx.lineCap = 'round';
  drawDots(ctx, clock ? G_BIG_UP : G_BIG, big.toUpperCase(), 7, c.accent, boost);
  drawDots(ctx, G_SMALL, clock, 17, c.ink);
  ctx.globalAlpha = 1;

  // Corner lamps on the roof of the box; they blink slowly and go solid when the score changes.
  const on = boost > 0 || Math.floor(now / 700) % 2 === 0;
  ctx.lineWidth = 1.3;
  for (const lx of [x0 + 12, x0 + w - 12]) {
    ctx.globalAlpha = 1; ctx.strokeStyle = c.ink; ctx.fillStyle = on ? c.accent : c.paper;
    ctx.beginPath(); line(ctx, lx, y0, lx, y0 - 3); ctx.stroke();
    ctx.beginPath(); ctx.arc(lx, y0 - 5, 2.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
