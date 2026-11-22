import { sfx } from '../audio/sfx';
import { FLOOR, G, H, R, W } from '../sim/constants';
import { releasePoint } from '../sim/shot';
import { hoopGeom } from '../sim/world';
import type { Game } from '../game/game';
import { drawFigure } from './figure';
import { flatCircle, hatch, path, proj, Z_BACK, Z_FRONT } from './iso';
import { Pen } from './pen';
import { drawCourtLines } from './court';

const FONT = 'ui-monospace, Menlo, Consolas, monospace';

// Pencil on paper. Black is for what you play with (figure, ball, hoop, wall); grey is the court
// and scenery. Depth is drawing only: the simulation is a flat side view at z = 0, and everything
// here (floor, shadows, the rim as a ring, the board as a slab) is projected around that plane.

interface Pop { x: number; y: number; t: number; txt: string; align: CanvasTextAlign }
type P = { x: number; y: number };

/** Light comes from the front left and above, so shadows fall back and to the right. */
function shadowOf(x: number, y: number): P {
  const h = Math.max(0, FLOOR - y);
  return proj(x + h * 0.22, FLOOR, h * 0.42);
}

/** Bounds of a list of points, for hatching. */
function box(pts: P[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly pen: Pen;
  hoopPos = { x: 790, y: FLOOR - 210 };
  private pops: Pop[] = [];
  private net = 0;
  private bird = { state: 'sit' as 'sit' | 'fly' | 'back', t: 0, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 };
  private gusts = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * (FLOOR - 120), l: 10 + Math.random() * 24 }));
  private dribHit = false;
  /** The court never moves, so it is drawn once into this layer and copied each frame. */
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.pen = new Pen(this.ctx);
    const resize = () => {
      const r = canvas.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * d));
      canvas.height = Math.max(1, Math.round(r.height * d));
    };
    new ResizeObserver(resize).observe(canvas);
    resize();
  }

  /** Screen point → world units. */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
  }

  /** Floating text. Default alignment is centred; 'right' anchors the text's right edge at x. */
  pop(txt: string, x: number, y: number, align: CanvasTextAlign = 'center'): void {
    const recent = this.pops.filter((p) => p.t < 0.5).length; // stack, don't overlap
    this.pops.push({ x, y: y - recent * 26, t: 0, txt, align });
  }
  clearPops(): void { this.pops = []; }
  netSwing(): void { this.net = 1; }

  update(dt: number, g: Game): void {
    const h = hoopGeom(g.world, g.tick);
    this.hoopPos = { x: h.x, y: h.y };
    this.net = Math.max(0, this.net - dt * 1.6);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.2);
    for (const s of this.gusts) { s.x += g.world.wind * dt * 0.9; if (s.x > W + 40) s.x = -40; if (s.x < -40) s.x = W + 40; }
    // The bird on the backboard flies off when a shot comes close, then comes back.
    const b = this.bird, perch = { x: h.x + 61, y: h.y - 84 };
    b.t += dt;
    if (b.state === 'sit') {
      b.x = perch.x; b.y = perch.y;
      if (g.ball && Math.hypot(g.ball.x - perch.x, g.ball.y - perch.y) < 95) { b.state = 'fly'; b.t = 0; b.vx = -50 - Math.random() * 70; b.vy = -170; }
    } else if (b.state === 'fly') {
      b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 45 * dt;
      if (b.t > 3.5) { b.state = 'back'; b.t = 0; b.fx = b.x; b.fy = b.y; }
    } else {
      const p = Math.min(b.t / 1.6, 1), e = p * p * (3 - 2 * p);
      b.x = b.fx + (perch.x - b.fx) * e; b.y = b.fy + (perch.y - b.fy) * e - Math.sin(p * Math.PI) * 30;
      if (p >= 1) { b.state = 'sit'; b.t = 0; }
    }
  }

  draw(g: Game): void {
    const { ctx, pen, canvas } = this;
    pen.frame(g.time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.court(), 0, 0);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const h = hoopGeom(g.world, g.tick);
    this.drawWind(g);
    this.drawShadows(g, h);
    this.drawHoopBack(g, h);
    this.drawWall(g);
    this.drawBird();
    g.mode?.draw?.(g, ctx);
    const f = drawFigure(pen, g);
    if (f.dribbleContact && !this.dribHit) sfx.bounce(f.dribbleTwoHand ? 0.7 : f.walking ? 0.3 : 0.45);
    this.dribHit = f.dribbleContact;
    if (f.ball) {
      this.ballShadow(f.ball.x, f.ball.y);
      pen.ball(f.ball.x, f.ball.y, f.ball.rot, f.ball.sq, R);
    }
    this.drawAim(g);
    if (g.ball) pen.ball(g.ball.x, g.ball.y, g.ball.rot, g.ball.sq, R);
    // The front of the rim and net go over the ball, so a make visibly drops through the ring.
    this.drawHoopFront(g, h);
    if (g.showHint && !g.aim && !g.ball) this.drawHint(g);
    for (const p of this.pops) {
      ctx.globalAlpha = 1 - p.t / 1.2;
      ctx.fillStyle = pen.c.ink; ctx.font = '800 22px ' + FONT;
      ctx.textAlign = p.align; ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.txt, Math.max(8, p.x), p.y - p.t * 50);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  // ---------- the court (cached) ----------

  private court(): HTMLCanvasElement {
    const { canvas, pen } = this, c = pen.c;
    const key = `${canvas.width}x${canvas.height}|${c.paper}|${c.ink}|${c.mute}|${c.faint}|${c.accent}|${c.wood}|${c.paint}`;
    if (this.bg && key === this.bgKey) return this.bg;
    const bg = this.bg ?? document.createElement('canvas');
    bg.width = canvas.width; bg.height = canvas.height;
    const x = bg.getContext('2d')!;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = c.paper; x.fillRect(0, 0, bg.width, bg.height);
    x.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    x.lineCap = 'round'; x.lineJoin = 'round';

    // Paper grain: a few hundred faint short strokes, fixed so they never flicker.
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    x.strokeStyle = c.mute; x.globalAlpha = 0.08; x.lineWidth = 0.8;
    x.beginPath();
    for (let i = 0; i < 420; i++) { const px = rnd() * W, py = rnd() * H, a = rnd() * 0.6 - 0.3; x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5); }
    x.stroke();
    x.globalAlpha = 1;

    // The floor: a plane seen from above, with a thick front edge like a stage.
    const A = proj(-260, FLOOR, Z_FRONT), B = proj(W + 120, FLOOR, Z_FRONT);
    const C = proj(W + 120, FLOOR, Z_BACK), D = proj(-260, FLOOR, Z_BACK);
    path(x, [A, B, C, D], true);
    x.fillStyle = c.wood; x.fill(); // hardwood
    // Floor shading: light hatching everywhere, a second pass darkening toward the back.
    x.strokeStyle = c.mute; x.lineWidth = 0.7; x.globalAlpha = 0.22;
    path(x, [A, B, C, D], true); hatch(x, box([A, B, C, D]), 11, -0.42);
    const M1 = proj(-260, FLOOR, Z_BACK - 120), M2 = proj(W + 120, FLOOR, Z_BACK - 120);
    x.globalAlpha = 0.18;
    path(x, [M1, M2, C, D], true); hatch(x, box([M1, M2, C, D]), 6, 0.9);
    x.globalAlpha = 1;
    // Boards running across the court, fainter as they recede.
    x.strokeStyle = c.mute; x.lineWidth = 1;
    [-80, -36, 8, 56, 108, 164, 224].forEach((z, i) => {
      x.globalAlpha = 0.32 - i * 0.035;
      path(x, [proj(-260, FLOOR, z), proj(W + 120, FLOOR, z)]); x.stroke();
    });
    x.globalAlpha = 1;
    // Back wall: a skirting board and a light hatched band along its foot.
    const S1 = proj(-260, FLOOR - 16, Z_BACK), S2 = proj(W + 120, FLOOR - 16, Z_BACK);
    x.strokeStyle = c.mute; x.lineWidth = 0.8; x.globalAlpha = 0.22;
    path(x, [S1, S2, C, D], true); hatch(x, box([S1, S2, C, D]), 5, -1.1);
    x.globalAlpha = 0.5; x.lineWidth = 1.2;
    path(x, [S1, S2]); x.stroke();
    x.globalAlpha = 1;
    // Back edge and the slab's front face.
    x.strokeStyle = c.mute; x.lineWidth = 1.6;
    path(x, [D, C]); x.stroke();
    const A2 = { x: A.x, y: A.y + 10 }, B2 = { x: B.x, y: B.y + 10 };
    path(x, [A, B, B2, A2], true);
    x.fillStyle = c.wood; x.fill();
    x.strokeStyle = c.ink; x.lineWidth = 1; x.globalAlpha = 0.55;
    path(x, [A, B, B2, A2], true); hatch(x, box([A, B, B2, A2]), 4, Math.PI / 4);
    x.globalAlpha = 1; x.lineWidth = 2.4;
    path(x, [A, B]); x.stroke();
    path(x, [A2, B2]); x.stroke();

    // Court markings: a real half court seen from the sideline (see court.ts).
    drawCourtLines(x, c.ink, c.mute, Z_FRONT, c.paint);

    this.bg = bg;
    this.bgKey = key;
    return bg;
  }

  // ---------- shadows ----------

  private drawShadows(g: Game, h: ReturnType<typeof hoopGeom>): void {
    const { ctx, pen } = this;
    ctx.strokeStyle = pen.c.ink;
    ctx.fillStyle = pen.c.ink;
    // Pole and backboard: one hatched band from the base toward the back.
    const top = shadowOf(h.poleX, h.y - 50), b1 = shadowOf(h.boardX, h.boardTop), b2 = shadowOf(h.boardX, h.boardBottom);
    ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
    const pole = [{ x: h.poleX - 4, y: FLOOR }, { x: h.poleX + 4, y: FLOOR }, { x: top.x + 4, y: top.y }, { x: top.x - 4, y: top.y }];
    path(ctx, pole, true); hatch(ctx, box(pole), 3.5, -0.2);
    const board = [b1, { x: b1.x + 34, y: b1.y - 20 }, { x: b2.x + 34, y: b2.y - 20 }, b2];
    path(ctx, board, true); hatch(ctx, box(board), 4, 0.6);
    // The wall casts a slab of shadow behind it.
    const wall = g.world.wall;
    if (wall) {
      const t1 = shadowOf(wall.x, FLOOR - wall.h), t2 = shadowOf(wall.x + wall.w, FLOOR - wall.h);
      const sh = [proj(wall.x, FLOOR, 26), proj(wall.x + wall.w, FLOOR, 26), { x: t2.x, y: t2.y }, { x: t1.x, y: t1.y }];
      path(ctx, sh, true); hatch(ctx, box(sh), 3.5, 0.6);
    }
    // The shooter: a soft pool under the feet and a long thin shadow toward the back.
    const fx = g.player.x, head = shadowOf(fx, FLOOR - 120);
    ctx.globalAlpha = 0.14; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(fx + 4, FLOOR - 2); ctx.lineTo(head.x, head.y); ctx.stroke();
    ctx.globalAlpha = 0.22;
    ctx.beginPath(); ctx.ellipse(fx + 4, FLOOR - 1, 20, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    // The ball in flight.
    if (g.ball) this.ballShadow(g.ball.x, g.ball.y);
    ctx.globalAlpha = 1;
  }

  /** A shadow that shrinks and fades as the ball rises, so height reads at a glance. */
  private ballShadow(bx: number, by: number): void {
    const { ctx, pen } = this, s = shadowOf(bx, by);
    const k = Math.max(0.3, 1 - (FLOOR - by) / 420);
    ctx.fillStyle = pen.c.ink; ctx.globalAlpha = 0.28 * k;
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 10 * k + 3, 3.4 * k + 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---------- hoop, in two halves ----------

  private rimRing(h: ReturnType<typeof hoopGeom>) {
    const r = (h.back.x - h.front.x) / 2, cx = h.front.x + r;
    return { r, cx };
  }

  private netStrands(g: Game, h: ReturnType<typeof hoopGeom>, front: boolean): void {
    const { ctx, pen } = this, { r, cx } = this.rimRing(h);
    const sw = this.net * Math.sin(g.time * 34) * 4, drop = 34 + this.net * 6, n = 12;
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = front ? 1.4 : 1; ctx.globalAlpha = front ? 1 : 0.55;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2, t2 = ((i + 1) / n) * Math.PI * 2;
      if (Math.sin(t) < 0 !== front) continue; // z < 0 is the front half
      const top = proj(cx + Math.cos(t) * r, h.y, Math.sin(t) * r);
      const bot = proj(cx + Math.cos(t) * r * 0.58 + sw, h.y + drop, Math.sin(t) * r * 0.58);
      const bot2 = proj(cx + Math.cos(t2) * r * 0.58 + sw, h.y + drop, Math.sin(t2) * r * 0.58);
      path(ctx, [top, bot]); ctx.stroke();
      path(ctx, [top, bot2]); ctx.stroke();
    }
    const ring = flatCircle(cx + sw, h.y + drop, 0, r * 0.58, front ? Math.PI : 0, front ? Math.PI * 2 : Math.PI, 14);
    path(ctx, ring); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawHoopBack(g: Game, h: ReturnType<typeof hoopGeom>): void {
    const { ctx, pen } = this, c = pen.c;
    const y = h.y, bx = h.boardX, px = h.poleX;
    // Pole: a cylinder, shaded on the side away from the light, on a flat base plate.
    ctx.strokeStyle = c.ink; ctx.lineWidth = 1.4;
    path(ctx, flatCircle(px, FLOOR, 0, 16, 0, Math.PI * 2, 20), true); ctx.fillStyle = c.paper; ctx.fill(); ctx.stroke();
    const pole = [{ x: px - 4, y: y - 50 }, { x: px + 4, y: y - 50 }, { x: px + 4, y: FLOOR }, { x: px - 4, y: FLOOR }];
    path(ctx, pole, true); ctx.fill();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.7;
    const shade = [{ x: px, y: y - 50 }, { x: px + 4, y: y - 50 }, { x: px + 4, y: FLOOR }, { x: px, y: FLOOR }];
    path(ctx, shade, true); hatch(ctx, box(shade), 2.6, -1.2);
    ctx.globalAlpha = 1; ctx.lineWidth = 2.2;
    path(ctx, pole, true); ctx.stroke();
    // Arm and brace to the board.
    ctx.lineWidth = 3.5;
    path(ctx, [{ x: px, y: y - 50 }, { x: bx + 7, y: y - 50 }]); ctx.stroke();
    ctx.lineWidth = 2;
    path(ctx, [{ x: px, y: y - 18 }, { x: bx + 7, y: y - 36 }]); ctx.stroke();
    // Backboard: a slab facing the shooter, seen slightly from above.
    const Z = 32, top = h.boardTop, bot = h.boardBottom;
    const face = [proj(bx, top, -Z), proj(bx, top, Z), proj(bx, bot, Z), proj(bx, bot, -Z)];
    const lid = [proj(bx, top, -Z), proj(bx + 7, top, -Z), proj(bx + 7, top, Z), proj(bx, top, Z)];
    const edge = [proj(bx, top, -Z), proj(bx + 7, top, -Z), proj(bx + 7, bot, -Z), proj(bx, bot, -Z)];
    ctx.fillStyle = c.paper; ctx.strokeStyle = c.ink;
    path(ctx, edge, true); ctx.fill();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.8; path(ctx, edge, true); hatch(ctx, box(edge), 2.4, -0.9); ctx.globalAlpha = 1;
    ctx.lineWidth = 2; path(ctx, edge, true); ctx.stroke();
    path(ctx, lid, true); ctx.fill(); ctx.stroke();
    path(ctx, face, true); ctx.fill();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.18; path(ctx, face, true); hatch(ctx, box(face), 5, -0.42); ctx.globalAlpha = 1;
    ctx.lineWidth = 2.6; path(ctx, face, true); ctx.stroke();
    // The shooter's square above the rim.
    ctx.lineWidth = 1.6;
    path(ctx, [proj(bx, y - 30, -12), proj(bx, y - 30, 12), proj(bx, y, 12), proj(bx, y, -12)], true); ctx.stroke();
    // Back half of the rim and net, behind the ball.
    const { r, cx } = this.rimRing(h);
    this.netStrands(g, h, false);
    ctx.lineWidth = 2.4; ctx.strokeStyle = c.ink;
    path(ctx, [{ x: h.back.x, y }, { x: bx, y }]); ctx.stroke();
    ctx.strokeStyle = c.accent; // the rim is the one orange line on the court
    path(ctx, flatCircle(cx, y, 0, r, 0, Math.PI, 18)); ctx.stroke();
  }

  private drawHoopFront(g: Game, h: ReturnType<typeof hoopGeom>): void {
    const { ctx, pen } = this, { r, cx } = this.rimRing(h);
    this.netStrands(g, h, true);
    ctx.strokeStyle = pen.c.accent; ctx.lineWidth = 3.4;
    path(ctx, flatCircle(cx, h.y, 0, r, Math.PI, Math.PI * 2, 18)); ctx.stroke();
  }

  // ---------- wall block ----------

  private drawWall(g: Game): void {
    const wall = g.world.wall; if (!wall) return;
    const { pen, ctx } = this, c = pen.c, { x, w, h } = wall, top = FLOOR - h, Z = 26;
    const front = [proj(x, top, -Z), proj(x + w, top, -Z), proj(x + w, FLOOR, -Z), proj(x, FLOOR, -Z)];
    const lid = [proj(x, top, -Z), proj(x + w, top, -Z), proj(x + w, top, Z), proj(x, top, Z)];
    const side = [proj(x + w, top, -Z), proj(x + w, top, Z), proj(x + w, FLOOR, Z), proj(x + w, FLOOR, -Z)];
    ctx.fillStyle = c.paper; ctx.strokeStyle = c.ink;
    for (const f of [side, lid, front]) { path(ctx, f, true); ctx.fill(); }
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85; path(ctx, side, true); hatch(ctx, box(side), 3, 0.5);
    path(ctx, side, true); hatch(ctx, box(side), 3, -0.9);
    ctx.globalAlpha = 0.45; path(ctx, front, true); hatch(ctx, box(front), 7, -Math.PI / 4);
    ctx.globalAlpha = 1; ctx.lineWidth = 2.4;
    for (const f of [side, lid, front]) { path(ctx, f, true); ctx.stroke(); }
  }

  // ---------- overlays ----------

  private drawWind(g: Game): void {
    const wind = g.world.wind; if (!wind) return;
    const { pen, ctx } = this;
    ctx.strokeStyle = pen.c.mute; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.6;
    for (const s of this.gusts) pen.seg({ x: s.x, y: s.y }, { x: s.x - Math.sign(wind) * s.l, y: s.y });
    ctx.globalAlpha = 1;
    const L = Math.min(Math.abs(wind) / 3, 80), sgn = Math.sign(wind), cx = 86, cy = 32;
    ctx.strokeStyle = pen.c.ink; ctx.fillStyle = pen.c.ink; ctx.lineWidth = 2.5;
    ctx.font = '600 12px ' + FONT; ctx.textBaseline = 'middle';
    ctx.fillText('WIND', 24, cy);
    const x0 = sgn > 0 ? cx : cx + L, x1 = sgn > 0 ? cx + L : cx;
    pen.seg({ x: x0, y: cy }, { x: x1, y: cy }); pen.seg({ x: x1, y: cy }, { x: x1 - sgn * 8, y: cy - 6 }); pen.seg({ x: x1, y: cy }, { x: x1 - sgn * 8, y: cy + 6 });
    ctx.fillText(`${Math.abs(Math.round(wind / 10))} mph`, cx + L + 12, cy);
    ctx.textBaseline = 'alphabetic';
  }

  private drawAim(g: Game): void {
    const aim = g.aim; if (!aim) return;
    const { pen, ctx } = this, v = aim.v, m = Math.hypot(v.x, v.y);
    if (m < 20) return;
    const pw = g.aimPower(), p = releasePoint(g.player.x, pw);
    if (aim.src === 'ptr' && aim.sx != null) {
      ctx.strokeStyle = pen.c.mute; ctx.lineWidth = 1.6; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(aim.sx, aim.sy!); ctx.lineTo(aim.cx!, aim.cy!); ctx.stroke(); ctx.setLineDash([]);
    }
    const n = g.mode?.aimDots(g) ?? 0;
    let x = p.x, y = p.y, vx = v.x, vy = v.y;
    const dt = 1 / 30;
    ctx.fillStyle = pen.c.ink;
    for (let i = 1; i <= n * 2; i++) {
      vx += g.world.wind * dt; vy += G * dt; x += vx * dt; y += vy * dt;
      if (y > FLOOR) break;
      if (i % 2 === 0) { ctx.globalAlpha = Math.max(0.15, 1 - i / (n * 2.2)); ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // Power gauge: a pencil-drawn tube that fills with hatching.
    const gx = g.player.x - 46, gy = FLOOR - 150;
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, 10, 80);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.rect(gx, gy + 80 * (1 - pw), 10, 80 * pw);
    hatch(ctx, { x: gx, y: gy + 80 * (1 - pw), w: 10, h: 80 * pw }, 2.4, -Math.PI / 4);
  }

  private drawHint(g: Game): void {
    const { pen, ctx } = this;
    ctx.fillStyle = pen.c.ink; ctx.font = '600 13px ' + FONT; ctx.textBaseline = 'alphabetic';
    const tx = Math.max(20, g.player.x - 150), ty = FLOOR - 230;
    ctx.fillText('PRESS, PULL BACK, LET GO', tx, ty);
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 2;
    const ax = tx + 90, ay = ty + 14;
    pen.seg({ x: ax, y: ay }, { x: ax - 40, y: ay + 40 }); pen.seg({ x: ax - 40, y: ay + 40 }, { x: ax - 30, y: ay + 40 }); pen.seg({ x: ax - 40, y: ay + 40 }, { x: ax - 40, y: ay + 30 });
  }

  private drawBird(): void {
    const { pen, ctx } = this, b = this.bird;
    ctx.strokeStyle = pen.c.mute; ctx.fillStyle = pen.c.mute; ctx.lineWidth = 1.8;
    if (b.state === 'sit') {
      const bob = (performance.now() / 1000) % 3 < 0.25 ? 2 : 0;
      ctx.beginPath(); ctx.ellipse(b.x, b.y - 6, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(b.x - 5, b.y - 11 + bob, 3.5, 0, Math.PI * 2); ctx.fill();
      pen.seg({ x: b.x - 8, y: b.y - 11 + bob }, { x: b.x - 12, y: b.y - 10 + bob });
      pen.seg({ x: b.x + 5, y: b.y - 7 }, { x: b.x + 11, y: b.y - 10 });
    } else {
      const f = Math.sin(b.t * 22) * 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
      pen.seg({ x: b.x, y: b.y }, { x: b.x - 9, y: b.y - 4 - f }); pen.seg({ x: b.x, y: b.y }, { x: b.x + 9, y: b.y - 4 - f });
    }
  }
}
