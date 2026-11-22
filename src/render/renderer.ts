import { sfx } from '../audio/sfx';
import { FLOOR, G, H, R, W } from '../sim/constants';
import { releasePoint } from '../sim/shot';
import { hoopGeom } from '../sim/world';
import type { Game } from '../game/game';
import { drawFigure } from './figure';
import { Pen } from './pen';

// Black is for what you play with (figure, ball, hoop, wall); grey is scenery.

interface Pop { x: number; y: number; t: number; txt: string; align: CanvasTextAlign }
type Mood = 'idle' | 'cheer' | 'ooh';

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  readonly pen: Pen;
  hoopPos = { x: 790, y: FLOOR - 210 };
  private pops: Pop[] = [];
  private net = 0;
  private crowd = { mood: 'idle' as Mood, t: 0, ph: Array.from({ length: 7 }, () => Math.random() * 6) };
  private bird = { state: 'sit' as 'sit' | 'fly' | 'back', t: 0, x: 0, y: 0, vx: 0, vy: 0, fx: 0, fy: 0 };
  private gusts = Array.from({ length: 16 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * (FLOOR - 80), l: 10 + Math.random() * 24 }));
  private dribHit = false;

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
    // Keep pops from stacking: nudge a new one up if another started in the last half second.
    const recent = this.pops.filter((p) => p.t < 0.5).length;
    this.pops.push({ x, y: y - recent * 26, t: 0, txt, align });
  }
  clearPops(): void { this.pops = []; }
  netSwing(): void { this.net = 1; }
  crowdMood(m: Mood): void { this.crowd.mood = m; this.crowd.t = 0; }

  update(dt: number, g: Game): void {
    const h = hoopGeom(g.world, g.tick);
    this.hoopPos = { x: h.x, y: h.y };
    this.net = Math.max(0, this.net - dt * 1.6);
    const c = this.crowd;
    c.t += dt;
    if (c.mood !== 'idle' && c.t > 1.4) c.mood = 'idle';
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
    ctx.fillStyle = pen.c.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.drawWind(g);
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 3; pen.seg({ x: 0, y: FLOOR }, { x: W, y: FLOOR });
    this.drawCrowd();
    this.drawWall(g);
    this.drawHoop(g);
    this.drawBird();
    g.mode?.draw?.(g, ctx);
    const f = drawFigure(pen, g);
    if (f.dribbleContact && !this.dribHit) sfx.bounce(f.dribbleTwoHand ? 0.7 : f.walking ? 0.3 : 0.45);
    this.dribHit = f.dribbleContact;
    if (f.ball) pen.ball(f.ball.x, f.ball.y, f.ball.rot, f.ball.sq, R);
    this.drawAim(g);
    if (g.ball) pen.ball(g.ball.x, g.ball.y, g.ball.rot, g.ball.sq, R);
    if (g.showHint && !g.aim && !g.ball) this.drawHint(g);
    for (const p of this.pops) {
      ctx.globalAlpha = 1 - p.t / 1.2;
      ctx.fillStyle = pen.c.ink; ctx.font = '22px "Rubik Mono One", ui-monospace, monospace';
      ctx.textAlign = p.align; ctx.textBaseline = 'alphabetic';
      ctx.fillText(p.txt, Math.max(8, p.x), p.y - p.t * 50);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
  }

  private drawHoop(g: Game): void {
    const { pen, ctx } = this, h = hoopGeom(g.world, g.tick);
    const x = h.x, y = h.y, bx = h.boardX, px = h.poleX;
    ctx.strokeStyle = pen.c.ink;
    ctx.lineWidth = 6; pen.seg({ x: px, y: FLOOR }, { x: px, y: y - 50 });
    ctx.lineWidth = 3.5; pen.seg({ x: px, y: y - 50 }, { x: bx + 7, y: y - 50 }); pen.seg({ x: px, y: y - 20 }, { x: bx + 7, y: y - 34 });
    ctx.lineWidth = 3; pen.seg({ x: px - 18, y: FLOOR }, { x: px + 18, y: FLOOR });
    ctx.fillStyle = pen.c.paper; ctx.fillRect(bx, h.boardTop, 7, h.boardBottom - h.boardTop); ctx.strokeRect(bx, h.boardTop, 7, h.boardBottom - h.boardTop);
    const fx = h.front.x, rw = h.back.x - fx;
    const sw = this.net * Math.sin(g.time * 34) * 4, drop = 34 + this.net * 6;
    const top = [0, 1, 2, 3].map((i) => ({ x: fx + (i * rw) / 3, y }));
    const bot = [0, 1, 2, 3].map((i) => ({ x: fx + rw * 0.2 + (i * rw * 0.6) / 3 + sw, y: y + drop }));
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) { pen.seg(top[i], bot[i]); if (i < 3) { pen.seg(top[i], bot[i + 1]); pen.seg(top[i + 1], bot[i]); } }
    pen.seg(bot[0], bot[3]);
    ctx.lineWidth = 3.5; pen.seg({ x: fx, y }, { x: bx, y });
  }

  private drawWall(g: Game): void {
    const wall = g.world.wall; if (!wall) return;
    const { pen, ctx } = this, { x, w, h } = wall, y = FLOOR - h;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 1.2;
    for (let k = -w; k < h + w; k += 9) pen.seg({ x, y: y + k }, { x: x + w, y: y + k - w });
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = pen.c.ink; ctx.strokeRect(x, y, w, h);
  }

  private drawWind(g: Game): void {
    const wind = g.world.wind; if (!wind) return;
    const { pen, ctx } = this;
    ctx.strokeStyle = pen.c.faint; ctx.lineWidth = 2;
    for (const s of this.gusts) pen.seg({ x: s.x, y: s.y }, { x: s.x - Math.sign(wind) * s.l, y: s.y });
    const L = Math.min(Math.abs(wind) / 3, 80), sgn = Math.sign(wind), cx = 86, cy = 32;
    ctx.strokeStyle = pen.c.ink; ctx.fillStyle = pen.c.ink; ctx.lineWidth = 2.5;
    ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
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
      ctx.strokeStyle = pen.c.faint; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
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
    const gx = g.player.x - 44, gy = FLOOR - 150;
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, 8, 80);
    ctx.fillStyle = pen.c.ink; ctx.fillRect(gx, gy + 80 * (1 - pw), 8, 80 * pw);
  }

  private drawHint(g: Game): void {
    const { pen, ctx } = this;
    ctx.fillStyle = pen.c.ink; ctx.font = '600 13px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'alphabetic';
    const tx = Math.max(20, g.player.x - 150), ty = FLOOR - 230;
    ctx.fillText('PRESS, PULL BACK, LET GO', tx, ty);
    ctx.strokeStyle = pen.c.ink; ctx.lineWidth = 2;
    const ax = tx + 90, ay = ty + 14;
    pen.seg({ x: ax, y: ay }, { x: ax - 40, y: ay + 40 }); pen.seg({ x: ax - 40, y: ay + 40 }, { x: ax - 30, y: ay + 40 }); pen.seg({ x: ax - 40, y: ay + 40 }, { x: ax - 40, y: ay + 30 });
  }

  private drawCrowd(): void {
    const { pen, ctx } = this, m = this.crowd.mood, t = this.crowd.t;
    ctx.lineWidth = 1.5; ctx.strokeStyle = pen.c.mute; ctx.fillStyle = pen.c.paper;
    for (let i = 0; i < 7; i++) {
      const x = 430 + i * 30, ph = this.crowd.ph[i];
      let bob = 0, lean = 0;
      if (m === 'cheer') bob = -Math.abs(Math.sin(t * 10 + ph)) * 7 * Math.max(0, 1 - t / 1.4);
      if (m === 'ooh') lean = Math.min(t * 20, 3);
      const hy = FLOOR + 30 + bob, hx = x + lean;
      ctx.beginPath(); ctx.arc(x, FLOOR + 56, 13, Math.PI, 2 * Math.PI); ctx.fill(); ctx.stroke();
      if (m === 'cheer' && t < 1.3) { pen.seg({ x: x - 10, y: FLOOR + 46 }, { x: x - 14, y: hy - 12 }); pen.seg({ x: x + 10, y: FLOOR + 46 }, { x: x + 14, y: hy - 12 }); }
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (m === 'ooh') { ctx.beginPath(); ctx.arc(hx + 2, hy + 2, 1.6, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (m === 'ooh') { ctx.fillStyle = pen.c.mute; ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textBaseline = 'alphabetic'; ctx.fillText('OOOH', 650, FLOOR + 36); }
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
