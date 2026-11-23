// The release trailer, drawn frame by frame with the real game engine.
//
// promo/render.mjs opens this page, calls trailer.frame(i) for every frame, pipes the frames to
// ffmpeg, then asks trailer.audio() for the soundtrack. Everything is deterministic: Math.random
// is seeded, shots are planned with the same simulation the game uses, and each planned shot is
// timed so the ball drops through the net exactly on a beat.
//
// Sound: a 120 BPM beat synthesized here, plus every game sound (dribbles, rim, swish, crowd)
// recorded as the game makes it and replayed through the game's own synth (sfxOffline).

import '../src/styles.css';
import { Game, type GameUi } from '../src/game/game';
import type { Hud, Mode } from '../src/game/types';
import { sfx, sfxOffline } from '../src/audio/sfx';
import { launchBall, makeLaunch, shotOver, stepBall, simulateShot, type ShotEvent, type ShotResult } from '../src/sim/shot';
import { hoopGeom, makeWorld, type World } from '../src/sim/world';
import { DT, FLOOR, RIM_W } from '../src/sim/constants';
import { updateSettings, type Backdrop } from '../src/settings';
import { icon } from '../src/ui/icons';
import { MARK } from '../src/ui/brand';
import { MODES } from '../src/modes/registry';
import { popLabel, scoreShot } from '../src/sim/scoring';

// ---------- determinism ----------
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = prng(20261123);
const fx = prng(7); // effects-only randomness, separate from the game's

// ---------- timing ----------
const params = new URLSearchParams(location.search);
const SITE = params.get('site') || 'stick-hoops.pages.dev';
const FPS = 30, SPB = 0.5, BEATS = 80;
const N = Math.round(BEATS * SPB * FPS);
const W = 1920, H = 1080;
const bt = (b: number) => b * SPB; // beat → seconds
const bf = (b: number) => Math.round(bt(b) * FPS); // beat → frame

const INK = '#121211', PAPER = '#fbfbf8', ACCENT = '#d9581a', BALL = '#f0883e', MUTE = '#6c6c66', WOOD = '#f1e2c6';
const MONO = '"DejaVu Sans Mono", "Liberation Mono", monospace';
const DISPLAY = 'Anton, Impact, sans-serif';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const backOut = (t: number) => { const c = 1.9; t = clamp(t) - 1; return t * t * ((c + 1) * t + c) + 1; };
const cubicOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

// ---------- sound recording ----------
type Ev = { name: string; args: unknown[]; t: number };
const evs: Ev[] = [];
let clock = 0;
const real: Record<string, (...a: unknown[]) => void> = {};
{
  const S = sfx as unknown as Record<string, unknown>;
  for (const k of Object.keys(sfx)) {
    const d = Object.getOwnPropertyDescriptor(sfx, k);
    if (!d || typeof d.value !== 'function' || k === 'resume' || k === 'toggle') continue;
    real[k] = (d.value as (...a: unknown[]) => void).bind(sfx);
    S[k] = (...a: unknown[]) => { evs.push({ name: k, args: a, t: clock }); };
  }
}
/** Schedule a sound at a beat (custom trailer sounds are prefixed "x:"). */
const cue = (name: string, beat: number, ...args: unknown[]) => evs.push({ name, args, t: bt(beat) });

// ---------- the game ----------
const gc = document.getElementById('game') as HTMLCanvasElement;
const out = document.getElementById('out') as HTMLCanvasElement;
let o = out.getContext('2d')!;
const ui: GameUi = { showOverlay() {}, hideOverlay() {}, overlayOpen: () => false, setHud() {} };
const g = new Game(gc, ui);
let aimDots = 0;
let hudFn: () => Hud = () => ({ left: 'Stick Hoops', mid: '', right: '00' });
let popOnMake = true;
const clipMode: Mode = {
  id: 'trailer', name: 'Trailer', start() {},
  aimDots: () => aimDots,
  onShotEnd(gg, r) { if (r.made && popOnMake) gg.pop(popLabel(scoreShot(r, { streak: 0 }))); },
  hud: () => hudFn(),
};
g.setMode(clipMode);
const gAcc = (v: number) => { (g as unknown as { acc: number }).acc = v; };

// ---------- shot planning ----------
const rimC = (w: World, tick: number) => { const h = hoopGeom(w, tick); return { x: h.x + RIM_W / 2, y: h.y }; };
/** Slow motion near the rim: full speed far away, a quarter speed as the ball reaches the net. */
function slowScale(bx: number, by: number, w: World, tick: number): number {
  const c = rimC(w, tick);
  const k = smooth((Math.hypot(bx - c.x, by - c.y) - 40) / 190);
  return 0.24 + 0.76 * k;
}
const cloneWorld = (w: Partial<World>): World => makeWorld(JSON.parse(JSON.stringify(w)) as Partial<World>);

/** Output frames from launch until the score (or the first rim touch, for a miss). */
function flightFrames(w: World, px: number, tick0: number, vx: number, vy: number, slow: boolean, until: 'score' | 'rim'): number {
  const b = launchBall(makeLaunch(tick0, px, vx, vy));
  let tick = tick0, acc = 0;
  const ev: ShotEvent[] = [];
  for (let f = 1; f < 900; f++) {
    acc += (slow ? slowScale(b.x, b.y, w, tick) : 1) / FPS;
    while (acc >= DT) {
      acc -= DT;
      stepBall(w, b, ++tick, ev);
      for (const e of ev) if (e.type === until) return f;
      ev.length = 0;
      if (shotOver(b)) throw new Error('shot ended before ' + until);
    }
  }
  throw new Error('flight too long');
}

interface Clip {
  start: number; end: number; // beats
  backdrop: Backdrop; scoreboard?: boolean;
  world?: Partial<World>; px: number;
  /** Beat on which the ball goes in (or hits the rim, for a miss). */
  at: number;
  wants: ((r: ShotResult) => boolean)[];
  angles?: [number, number];
  slow?: boolean; miss?: boolean;
  variant?: 0 | 1; tag?: string;
  /** Seconds of visible pull-back before the release. */
  aim?: number; dots?: number;
  hud?: () => Hud;
  // filled in by plan()
  vx?: number; vy?: number; launchF?: number; startTick?: number; aimF?: number; r?: ShotResult;
}
const T_LAUNCH = 6000;

function plan(c: Clip): void {
  const [a0, a1] = c.angles ?? [50, 64];
  const mid = (a0 + a1) / 2;
  const angles: number[] = [];
  for (let a = a0; a <= a1; a += 0.5) angles.push(a);
  angles.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
  for (const want of c.wants) {
    for (const a of angles) {
      for (let sp = 360; sp <= 1120; sp += 3) {
        const rad = (-a * Math.PI) / 180, vx = Math.cos(rad) * sp, vy = Math.sin(rad) * sp;
        const r = simulateShot(cloneWorld(c.world ?? {}), makeLaunch(T_LAUNCH, c.px, vx, vy));
        if (!want(r)) continue;
        const f = flightFrames(cloneWorld(c.world ?? {}), c.px, T_LAUNCH, vx, vy, !!c.slow, c.miss ? 'rim' : 'score');
        Object.assign(c, { vx, vy, r });
        c.launchF = bf(c.at) - f + 1;
        c.aimF = Math.max(bf(c.start) + 4, c.launchF - Math.round((c.aim ?? 0.75) * FPS));
        c.startTick = T_LAUNCH - (c.launchF - bf(c.start)) * 8;
        return;
      }
    }
  }
  throw new Error(`no shot for clip at beat ${c.start}`);
}

function enterClip(c: Clip | { backdrop: Backdrop; scoreboard?: boolean; px: number; world?: Partial<World>; variant?: 0 | 1; tag?: string; hud?: () => Hud; dots?: number }): void {
  g.setMode(clipMode);
  g.world = cloneWorld(c.world ?? {});
  g.player.x = g.player.tx = c.px;
  g.player.variant = c.variant ?? 0;
  g.player.tag = c.tag ?? '';
  g.tick = 'startTick' in c && c.startTick != null ? c.startTick : 1000;
  gAcc(0);
  updateSettings({ backdrop: c.backdrop, scoreboard: !!c.scoreboard });
  aimDots = c.dots ?? 0;
  hudFn = c.hud ?? (() => ({ left: 'Stick Hoops', mid: '', right: '00' }));
}

/** Advance a clip by one output frame. */
function stepClip(c: Clip, F: number): void {
  const PULL = 5.4;
  if (F >= c.aimF! && F < c.launchF!) {
    const p = (F - c.aimF!) / Math.max(1, c.launchF! - c.aimF!);
    const k = cubicOut(Math.min(1, p / 0.78));
    const s = { x: g.player.x + 26, y: FLOOR - 150 };
    const v = { x: c.vx! * k, y: c.vy! * k };
    g.aim = { src: 'ptr', sx: s.x, sy: s.y, cx: s.x - v.x / PULL, cy: s.y - v.y / PULL, v };
  }
  if (F === c.launchF) {
    g.aim = null;
    g.tick = T_LAUNCH;
    gAcc(0);
    g.shoot(c.vx!, c.vy!);
    if (!g.ball) throw new Error(`could not shoot at frame ${F}`);
  }
  const sc = c.slow && g.ball ? slowScale(g.ball.x, g.ball.y, g.world, g.tick) : 1;
  g.update(sc / FPS);
}

// ---------- images ----------
function svgImage(svg: string, size: number): Promise<HTMLImageElement> {
  let s = svg.replace(/var\(--accent\)/g, ACCENT).replace(/var\(--ball\)/g, BALL).replace(/currentColor/g, INK);
  if (!s.includes('xmlns=')) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  s = s.replace('<svg', `<svg width="${size}" height="${size}"`);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  return img.decode().then(() => img);
}
let markImg: HTMLImageElement;
const iconImg: Record<string, HTMLImageElement> = {};

// ---------- drawing helpers ----------
let grain: HTMLCanvasElement;
function makeGrain(): void {
  grain = document.createElement('canvas');
  grain.width = W + 64; grain.height = H + 64;
  const c = grain.getContext('2d')!;
  for (let i = 0; i < 26000; i++) {
    c.fillStyle = `rgba(18,18,17,${0.08 + fx() * 0.25})`;
    const s = fx() < 0.9 ? 1 : 2;
    c.fillRect(fx() * grain.width, fx() * grain.height, s, s);
  }
  // paper fibres
  c.strokeStyle = 'rgba(18,18,17,0.10)'; c.lineWidth = 1;
  for (let i = 0; i < 500; i++) {
    const x = fx() * grain.width, y = fx() * grain.height, a = fx() * Math.PI, l = 6 + fx() * 18;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
}

let trauma = 0;
const shakeAt = new Map<number, number>();
const addShake = (beat: number, amt: number) => shakeAt.set(bf(beat), (shakeAt.get(bf(beat)) ?? 0) + amt);

interface Cam { z: number; fx: number; fy: number; rot?: number }
const CAM0: Cam = { z: 1, fx: 480, fy: 270 };
let shakeX = 0, shakeY = 0, shakeR = 0;

/** Transform for world units (960×540) under a camera. */
function worldT(cam: Cam): void {
  // Never look past the edge of the court: keep the view inside the 960×540 world.
  const hw = 480 / cam.z, hh = 270 / cam.z;
  const fxc = clamp(cam.fx, hw, 960 - hw), fyc = clamp(cam.fy, hh, 540 - hh);
  cam = { ...cam, fx: cam.z >= 1 ? fxc : 480, fy: cam.z >= 1 ? fyc : 270 };
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.translate(W / 2 + shakeX, H / 2 + shakeY);
  o.rotate((cam.rot ?? 0) + shakeR);
  o.scale(2 * cam.z, 2 * cam.z);
  o.translate(-cam.fx, -cam.fy);
}
function screenT(): void { o.setTransform(1, 0, 0, 1, shakeX * 0.5, shakeY * 0.5); }

function drawGame(cam: Cam): void {
  paper();
  g.draw();
  worldT(cam);
  o.drawImage(gc, 0, 0, 960, 540);
  o.setTransform(1, 0, 0, 1, 0, 0);
}
function paper(): void { o.setTransform(1, 0, 0, 1, 0, 0); o.fillStyle = PAPER; o.fillRect(0, 0, W, H); }

/** Rubber-stamp text: slams in from big, with an offset ink shadow. */
function stamp(text: string, x: number, y: number, size: number, t: number, o2: { font?: string; weight?: string; fill?: string; rot?: number; align?: CanvasTextAlign; shadow?: number; stroke?: number; alpha?: number } = {}): void {
  if (t < 0) return;
  const k = Math.min(1, t / 0.11);
  const s = 2.3 - 1.3 * k * k + (k >= 1 ? Math.sin(Math.min(1, (t - 0.11) / 0.2) * Math.PI) * 0.05 : 0);
  o.save();
  o.translate(x, y); o.rotate(o2.rot ?? 0); o.scale(s, s);
  o.globalAlpha = Math.min(1, t / 0.05) * (o2.alpha ?? 1);
  o.font = `${o2.weight ?? '700'} ${size}px ${o2.font ?? MONO}`;
  o.textAlign = o2.align ?? 'center'; o.textBaseline = 'alphabetic'; o.lineJoin = 'round';
  const sh = o2.shadow ?? size * 0.06;
  if (sh) { o.fillStyle = INK; o.fillText(text, sh, sh); if (o2.stroke) { o.lineWidth = o2.stroke; o.strokeStyle = INK; o.strokeText(text, sh, sh); } }
  if (o2.stroke) { o.lineWidth = o2.stroke; o.strokeStyle = INK; o.strokeText(text, 0, 0); }
  o.fillStyle = o2.fill ?? INK; o.fillText(text, 0, 0);
  o.restore();
}

/** Highlighter caption: an orange bar wipes in, then the words. */
function caption(text: string, x: number, y: number, t: number, dur: number, size = 58, align: 'left' | 'center' = 'left'): void {
  if (t < 0 || t > dur) return;
  o.save();
  o.font = `700 ${size}px ${MONO}`;
  const w = o.measureText(text).width, padX = size * 0.4, h = size * 1.32;
  const left = align === 'center' ? x - w / 2 - padX : x - padX;
  const inP = cubicOut(t / 0.22), outP = smooth((t - (dur - 0.22)) / 0.22);
  const x0 = left + (w + padX * 2) * outP, x1 = left + (w + padX * 2) * inP;
  if (x1 > x0) {
    const top = y - size * 1.0;
    o.beginPath();
    o.rect(x0, top - 6, x1 - x0 + 14, h + 20);
    o.clip();
    // hatched shadow
    o.save(); o.translate(10, 10);
    o.beginPath(); roughRect(left, top, w + padX * 2, h); o.clip();
    o.strokeStyle = INK; o.lineWidth = 2;
    for (let i = -h; i < w + padX * 2; i += 7) { o.beginPath(); o.moveTo(left + i, top + h); o.lineTo(left + i + h, top); o.stroke(); }
    o.restore();
    o.fillStyle = ACCENT; o.strokeStyle = INK; o.lineWidth = 4;
    o.beginPath(); roughRect(left, top, w + padX * 2, h); o.fill(); o.stroke();
    o.fillStyle = INK; o.textBaseline = 'alphabetic'; o.textAlign = 'left';
    o.fillText(text, left + padX, y + size * 0.06);
  }
  o.restore();
}
function roughRect(x: number, y: number, w: number, h: number): void {
  const j = (i: number) => Math.sin(i * 12.9898 + x * 0.01) * 2.4;
  o.moveTo(x + j(1), y + j(2)); o.lineTo(x + w + j(3), y + j(4)); o.lineTo(x + w + j(5), y + h + j(6)); o.lineTo(x + j(7), y + h + j(8)); o.closePath();
}

/** A comic-book burst behind a shouted word, with speed lines and ink splats. */
function burst(word: string, x: number, y: number, t: number, scale = 1, rot = -0.07, seed = 1): void {
  if (t < 0 || t > 1.5) return;
  const r = prng(seed * 977);
  const inP = Math.min(1, t / 0.16), outP = smooth((t - 1.15) / 0.35);
  const s = scale * (0.25 + 0.75 * backOut(inP)) * (1 + outP * 0.25);
  o.save();
  o.globalAlpha = 1 - outP;
  o.translate(x, y); o.rotate(rot + Math.sin(t * 18) * 0.02 * (1 - inP));
  // speed lines
  const reach = Math.min(1, t * 3.5);
  o.fillStyle = INK;
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + r() * 0.12, r0 = (230 + r() * 40) * s, r1 = r0 + (160 + r() * 380) * reach * s, wdt = (3 + r() * 7) * s;
    const ca = Math.cos(a), sa = Math.sin(a);
    o.beginPath();
    o.moveTo(ca * r0 - sa * wdt, sa * r0 + ca * wdt); o.lineTo(ca * r0 + sa * wdt, sa * r0 - ca * wdt); o.lineTo(ca * r1, sa * r1);
    o.fill();
  }
  // ink splats
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = (250 + r() * 220) * s * Math.min(1, t * 6), rr = (6 + r() * 20) * s;
    o.beginPath(); o.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, Math.PI * 2); o.fill();
    o.beginPath(); o.arc(Math.cos(a) * (d + rr * 2.2), Math.sin(a) * (d + rr * 2.2), rr * 0.35, 0, Math.PI * 2); o.fill();
  }
  // star
  const spikes = 16;
  const star = (R1: number, R2: number) => {
    o.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2, rad = (i % 2 ? R2 : R1) * (0.9 + ((i * 7919) % 13) / 60);
      o[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rad * 1.35, Math.sin(a) * rad);
    }
    o.closePath();
  };
  o.save(); o.translate(14 * s, 14 * s); star(250 * s, 165 * s); o.fillStyle = INK; o.fill(); o.restore();
  star(250 * s, 165 * s); o.fillStyle = ACCENT; o.fill(); o.lineWidth = 8 * s; o.strokeStyle = INK; o.lineJoin = 'round'; o.stroke();
  star(175 * s, 120 * s); o.fillStyle = BALL; o.fill();
  // word
  const size = (word.length > 7 ? 118 : 150) * s;
  o.font = `400 ${size}px ${DISPLAY}`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.lineJoin = 'round';
  o.lineWidth = size * 0.11; o.strokeStyle = INK;
  o.fillStyle = INK; o.fillText(word, size * 0.05, size * 0.05 + 6); o.strokeText(word, size * 0.05, size * 0.05 + 6);
  o.strokeText(word, 0, 6); o.fillStyle = PAPER; o.fillText(word, 0, 6);
  o.restore();
}

/** Thick scribble path across the screen, for wipes and the opening reveal. */
function scribblePath(rows: number, seed: number, wide: number): { x: number; y: number }[] {
  const r = prng(seed), pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= rows; i++) {
    const x = -wide + (i / rows) * (W + wide * 2) + (r() - 0.5) * 40;
    pts.push({ x, y: i % 2 ? H + 120 : -120 });
  }
  return pts;
}
function strokePath(pts: { x: number; y: number }[], from: number, to: number, width: number): { x: number; y: number; a: number } | null {
  // from/to are fractions of the total length
  const segs: number[] = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(d); total += d; }
  const a = from * total, b = to * total;
  let acc = 0, started = false, head: { x: number; y: number; a: number } | null = null;
  o.lineWidth = width; o.lineCap = 'round'; o.lineJoin = 'round';
  o.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i], d = segs[i - 1];
    const s0 = clamp((a - acc) / d), s1 = clamp((b - acc) / d);
    if (s1 > s0) {
      const x0 = lerp(p0.x, p1.x, s0), y0 = lerp(p0.y, p1.y, s0), x1 = lerp(p0.x, p1.x, s1), y1 = lerp(p0.y, p1.y, s1);
      if (!started) { o.moveTo(x0, y0); started = true; }
      o.lineTo(x1, y1);
      head = { x: x1, y: y1, a: Math.atan2(p1.y - p0.y, p1.x - p0.x) };
    }
    acc += d;
  }
  o.stroke();
  return head;
}

/** A pencil, tip at (x, y), drawn as a chunky orange pencil. */
function pencil(x: number, y: number, ang: number): void {
  o.save(); o.translate(x, y); o.rotate(ang);
  o.lineWidth = 5; o.strokeStyle = INK; o.lineJoin = 'round';
  // tip (wood) and graphite
  o.fillStyle = WOOD; o.beginPath(); o.moveTo(0, 0); o.lineTo(-70, -26); o.lineTo(-70, 26); o.closePath(); o.fill(); o.stroke();
  o.fillStyle = INK; o.beginPath(); o.moveTo(0, 0); o.lineTo(-22, -8); o.lineTo(-22, 8); o.closePath(); o.fill();
  // body
  o.fillStyle = BALL; o.fillRect(-380, -26, 310, 52); o.strokeRect(-380, -26, 310, 52);
  o.beginPath(); o.moveTo(-380, -9); o.lineTo(-70, -9); o.moveTo(-380, 9); o.lineTo(-70, 9); o.lineWidth = 2.5; o.stroke();
  // ferrule and eraser
  o.lineWidth = 5; o.fillStyle = '#c9c9c0'; o.fillRect(-430, -27, 50, 54); o.strokeRect(-430, -27, 50, 54);
  o.fillStyle = '#e9a28c'; o.beginPath(); o.roundRect(-490, -26, 62, 52, [16, 0, 0, 16]); o.fill(); o.stroke();
  o.restore();
}

/** Ink trail behind the flying ball, in world units. */
const trail: { x: number; y: number }[] = [];
function drawTrail(cam: Cam): void {
  if (g.ball) { trail.push({ x: g.ball.x, y: g.ball.y }); if (trail.length > 14) trail.shift(); } else if (trail.length) trail.shift();
  if (trail.length < 3) return;
  worldT(cam);
  for (let i = 1; i < trail.length; i++) {
    const k = i / trail.length;
    o.strokeStyle = `rgba(217,88,26,${0.5 * k})`; o.lineWidth = 2 + 16 * k; o.lineCap = 'round';
    o.beginPath(); o.moveTo(trail[i - 1].x, trail[i - 1].y); o.lineTo(trail[i].x, trail[i].y); o.stroke();
  }
  o.setTransform(1, 0, 0, 1, 0, 0);
}

/** The finger doing the pull-back, in world units. */
function drawFinger(cam: Cam): void {
  const a = g.aim; if (!a || a.sx == null) return;
  worldT(cam);
  o.lineWidth = 2; o.strokeStyle = INK; o.setLineDash([4, 4]);
  o.beginPath(); o.arc(a.sx, a.sy!, 13, 0, Math.PI * 2); o.stroke(); o.setLineDash([]);
  o.fillStyle = 'rgba(251,251,248,0.85)'; o.lineWidth = 3;
  o.beginPath(); o.arc(a.cx!, a.cy!, 15, 0, Math.PI * 2); o.fill(); o.stroke();
  o.fillStyle = ACCENT; o.beginPath(); o.arc(a.cx!, a.cy!, 6, 0, Math.PI * 2); o.fill();
  o.setTransform(1, 0, 0, 1, 0, 0);
}

function flash(alpha: number, color = PAPER): void {
  if (alpha <= 0) return;
  o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = clamp(alpha); o.fillStyle = color; o.fillRect(0, 0, W, H); o.globalAlpha = 1;
}

// ---------- scenes ----------
const C = (c: Clip) => c;
const clips = {
  swish: C({ start: 16, end: 22, backdrop: 'plain', px: 430, at: 20.5, wants: [(r) => r.made && r.swish], slow: true, aim: 1.0, dots: 9 }),
  bank: C({ start: 22, end: 28, backdrop: 'gym', px: 560, at: 26, wants: [(r) => r.made && r.bank], angles: [40, 70], aim: 0.8 }),
  wall: C({ start: 28, end: 34, backdrop: 'street', px: 380, world: { hoop: { bx: 790, by: FLOOR - 250, mx: 0, my: 0, sp: 1 }, wall: { x: 600, w: 16, h: 190 }, wind: -120 }, at: 32, wants: [(r) => r.made && r.offWall, (r) => r.made && r.swish, (r) => r.made], angles: [52, 75], aim: 0.8 }),
  elevator: C({ start: 34, end: 40, backdrop: 'notebook', px: 420, world: { hoop: { bx: 790, by: FLOOR - 210, mx: 0, my: 70, sp: 1.3 } }, at: 38.5, wants: [(r) => r.made && r.swish, (r) => r.made], aim: 0.8, slow: true }),
  p2: C({ start: 48, end: 56, backdrop: 'gym', px: 470, tag: 'P2', variant: 1, at: 50.5, miss: true, wants: [(r) => r.rimOut && !r.made], aim: 0.7 }),
  buzzer: C({
    start: 64, end: 72, backdrop: 'gym', scoreboard: true, px: 205, at: 70, slow: true, aim: 1.1,
    wants: [(r) => r.made && r.swish], angles: [50, 62],
    hud: () => {
      const b = clock / SPB, sec = b >= 70 ? 0 : b >= 67 ? 70 - Math.floor(b) : 3;
      return { left: '60 Seconds', mid: `0:0${sec}`, right: b >= 70 ? '61' : '57' };
    },
  }),
};
const allClips = Object.values(clips);

type Scene = { from: number; to: number; enter?: () => void; frame: (F: number, b: number) => void };

let revealPts: { x: number; y: number }[] = [];
const wipes = [16, 40, 48, 56, 64, 72];
const cuts = [22, 28, 34];
const wipePts = new Map<number, { x: number; y: number }[]>();

const scenes: Scene[] = [
  // 0–8: a pencil draws the court, the stick figure starts dribbling.
  {
    from: 0, to: 8,
    enter() { enterClip({ backdrop: 'plain', px: 470 }); revealPts = scribblePath(30, 5, 120); },
    frame(F, b) {
      g.update(1 / FPS);
      const z = lerp(1.18, 1.0, smooth((b - 4) / 4));
      const cam = { z, fx: lerp(560, 480, smooth(b / 8)), fy: lerp(300, 270, smooth(b / 8)) };
      paper();
      g.draw();
      // Reveal the game through the scribble drawn so far.
      const p = smooth((b - 0.4) / 4.6);
      const tmp = scratch();
      const tc = tmp.getContext('2d')!;
      tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, H);
      ctxSwap(tc, () => { tc.strokeStyle = '#000'; strokePath(revealPts, 0, p, 150); });
      tc.globalCompositeOperation = 'source-in';
      tc.setTransform(1, 0, 0, 1, 0, 0);
      tc.translate(W / 2, H / 2); tc.scale(2 * cam.z, 2 * cam.z); tc.translate(-cam.fx, -cam.fy);
      tc.drawImage(gc, 0, 0, 960, 540);
      tc.globalCompositeOperation = 'source-over';
      o.drawImage(tmp, 0, 0);
      if (p > 0 && p < 1) {
        // The pencil follows the head of the scribble.
        o.save(); o.globalAlpha = 0;
        const head = strokePath(revealPts, 0, p, 0.0001);
        o.restore();
        if (head) pencil(head.x, head.y, -0.9 + Math.sin(F * 0.7) * 0.06);
      }
      screenT();
      caption('A BASKETBALL GAME', 120, 900, bt(b - 5), bt(1.5), 52);
      caption('DRAWN IN PENCIL.', 120, 985, bt(b - 5.5), bt(2), 52);
    },
  },
  // 8–16: the title, stamped letter by letter.
  {
    from: 8, to: 16,
    frame(F, b) {
      g.update(1 / FPS);
      drawGame({ z: 1 + (b - 8) * 0.01, fx: 480, fy: 270 });
      flash(0.84);
      const word = 'STICK HOOPS';
      o.setTransform(1, 0, 0, 1, shakeX, shakeY);
      const size = 170;
      o.font = `700 ${size}px ${MONO}`;
      const cw = o.measureText('M').width, x0 = W / 2 - (cw * word.length) / 2 + cw / 2;
      let n = 0;
      for (let i = 0; i < word.length; i++) {
        if (word[i] === ' ') continue;
        stamp(word[i], x0 + i * cw, 560, size, bt(b - (8 + n * 0.5)), { rot: ((i * 37) % 7 - 3) * 0.012, weight: '700' });
        n++;
      }
      // underline scribble
      const u = smooth((b - 13) / 0.8);
      if (u > 0) {
        o.strokeStyle = INK; o.lineCap = 'round';
        o.lineWidth = 14; o.beginPath(); o.moveTo(x0 - cw * 0.4, 610); o.lineTo(lerp(x0 - cw * 0.4, x0 + cw * 10.3, u), 604); o.stroke();
        o.lineWidth = 5; o.beginPath(); o.moveTo(x0 - cw * 0.2, 628); o.lineTo(lerp(x0 - cw * 0.2, x0 + cw * 10.6, u), 626); o.stroke();
      }
      // the mark drops in and lands on beat 14
      const mt = bt(b - 13.2), land = bt(0.8);
      if (mt > 0) {
        const k = Math.min(1, mt / land);
        const y = lerp(-260, 300, k * k);
        const sq = mt > land ? 1 - Math.sin(Math.min(1, (mt - land) / 0.25) * Math.PI) * 0.18 : 1;
        o.save(); o.translate(W / 2, y + 120); o.scale(1 / sq, sq); o.drawImage(markImg, -120, -240, 240, 240); o.restore();
      }
      o.setTransform(1, 0, 0, 1, 0, 0);
      stamp('PULL BACK.', W / 2 - 430, 780, 54, bt(b - 14), { fill: INK });
      stamp('LET GO.', W / 2 - 20, 780, 54, bt(b - 14.5), { fill: INK });
      stamp('SWISH.', W / 2 + 360, 780, 54, bt(b - 15), { fill: ACCENT });
    },
  },
  // 16–32: four plays, each ball dropping on a downbeat.
  ...([
    [clips.swish, [['PULL BACK', 16.3, 1.6], ['LET GO', 18.0, 2]], 'SWISH!'],
    [clips.bank, [['OFF THE GLASS', 22.3, 3.5]], 'BANK!'],
    [clips.wall, [['WALLS. WIND.', 28.3, 3.5]], 'BUCKET!'],
    [clips.elevator, [['MOVING HOOPS', 34.3, 4]], 'NOTHING BUT NET!'],
  ] as [Clip, [string, number, number][], string][]).map(([c, caps, word]): Scene => ({
    from: c.start, to: c.end,
    enter() { enterClip(c); trail.length = 0; },
    frame(F, b) {
      stepClip(c, F);
      const slowing = c.slow && g.ball ? 1 - slowScale(g.ball.x, g.ball.y, g.world, g.tick) : 0;
      const rc = rimC(g.world, g.tick);
      const zoomIn = smooth(slowing * 1.4);
      const cam = { z: 1 + 0.35 * zoomIn + (b - c.start) * 0.01, fx: lerp(480, rc.x - 60, zoomIn * 0.8), fy: lerp(270, rc.y + 10, zoomIn * 0.8) };
      drawGame(cam);
      drawTrail(cam);
      drawFinger(cam);
      screenT();
      for (const [text, at, dur] of caps) caption(text, 110, 150, bt(b - at), bt(dur), 64);
      // the burst sits over the hoop, in screen space
      const hx = W / 2 + (rc.x - cam.fx) * 2 * cam.z, hy = H / 2 + (rc.y - cam.fy) * 2 * cam.z;
      burst(word, clamp(hx - 330, 420, W - 420), clamp(hy - 120, 300, H - 300), bt(b - c.at), word.length > 8 ? 0.85 : 1, -0.08, c.start);
    },
  })),
  // 32–40: six modes, one card per beat.
  {
    from: 40, to: 48,
    frame(F, b) {
      g.update(1 / FPS);
      paper();
      screenT();
      caption('SIX WAYS TO PLAY', W / 2, 165, bt(b - 40), bt(8), 70, 'center');
      MODES.forEach((m, i) => {
        const t = bt(b - (41 + i * 0.85));
        if (t < 0) return;
        const col = i % 3, row = Math.floor(i / 3);
        const cx = 130 + col * 570 + 260, cy = 300 + row * 360 + 150;
        const k = backOut(Math.min(1, t / 0.28));
        const rot = ((i * 53) % 7 - 3) * 0.012 + (1 - Math.min(1, t / 0.28)) * (i % 2 ? 0.2 : -0.2);
        const drift = Math.sin(t * 2 + i) * 4;
        o.save(); o.translate(cx, cy + drift); o.rotate(rot); o.scale(k, k);
        // hatched shadow
        o.save(); o.translate(14, 14); o.beginPath(); o.rect(-260, -150, 520, 300); o.clip();
        o.strokeStyle = INK; o.lineWidth = 2;
        for (let d = -600; d < 600; d += 8) { o.beginPath(); o.moveTo(d, 160); o.lineTo(d + 310, -160); o.stroke(); }
        o.restore();
        o.fillStyle = PAPER; o.strokeStyle = INK; o.lineWidth = 5; o.fillRect(-260, -150, 520, 300); o.strokeRect(-260, -150, 520, 300);
        o.drawImage(iconImg[m.id], -226, -122, 84, 84);
        const duo = m.group === 'duo';
        o.font = `700 22px ${MONO}`; const tag = duo ? '2 PLAYERS' : 'SOLO'; const tw = o.measureText(tag).width;
        o.fillStyle = duo ? ACCENT : PAPER; o.lineWidth = 3; o.fillRect(226 - tw - 24, -120, tw + 24, 40); o.strokeRect(226 - tw - 24, -120, tw + 24, 40);
        o.fillStyle = INK; o.textAlign = 'left'; o.textBaseline = 'middle'; o.fillText(tag, 226 - tw - 12, -99);
        o.font = `700 50px ${MONO}`; o.textBaseline = 'alphabetic'; o.fillText(m.name.toUpperCase(), -226, 28);
        o.font = `400 25px ${MONO}`; o.fillStyle = MUTE;
        wrap(m.blurb, 452).forEach((line, li) => o.fillText(line, -226, 78 + li * 34));
        o.restore();
      });
    },
  },
  // 48–56: two players, one phone.
  {
    from: 48, to: 56,
    enter() { enterClip(clips.p2); trail.length = 0; },
    frame(F, b) {
      stepClip(clips.p2, F);
      const z = 1 + smooth((b - 51) / 3) * 0.08;
      const cam = { z, fx: 480, fy: 270 };
      drawGame(cam); drawTrail(cam); drawFinger(cam);
      screenT();
      caption('PASS THE PHONE.', 110, 150, bt(b - 48.2), bt(1.6), 64);
      caption('P2 TO MATCH…', 110, 150, bt(b - 49.9), bt(1.4), 64);
      // H-O-R-S-E slammed across the screen
      'HORSE'.split('').forEach((ch, i) => {
        stamp(ch, 470 + i * 245, 640, 330, bt(b - (51.5 + i * 0.5)), { font: DISPLAY, weight: '400', fill: i % 2 ? PAPER : ACCENT, stroke: 14, shadow: 14, rot: ((i * 31) % 5 - 2) * 0.04 });
      });
      caption('HORSE & SABOTAGE · 2 PLAYERS, 1 DEVICE', W / 2, 960, bt(b - 54), bt(2), 44, 'center');
    },
  },
  // 56–64: pick your court; backdrops cut on the beat, faster and faster.
  {
    from: 56, to: 64,
    enter() { enterClip({ backdrop: 'plain', px: 470 }); },
    frame(F, b) {
      const seq: [number, Backdrop, boolean][] = [
        [56, 'plain', false], [57, 'gym', false], [58, 'street', false], [59, 'notebook', false],
        [60, 'gym', true], [61, 'street', true], [62, 'notebook', true], [62.5, 'plain', true],
        [63, 'gym', true], [63.25, 'street', true], [63.5, 'notebook', true], [63.75, 'gym', true],
      ];
      let cur = seq[0];
      for (const s of seq) if (b >= s[0]) cur = s;
      updateSettings({ backdrop: cur[1], scoreboard: cur[2] });
      const pts = Math.max(0, Math.floor((b - 60) * 4)) * 3;
      hudFn = () => ({ left: 'Stick Hoops', mid: `0:${String(Math.max(4, 60 - Math.floor((b - 56) * 7))).padStart(2, '0')}`, right: String(pts).padStart(2, '0') });
      g.update(1 / FPS);
      drawGame({ z: 1 + smooth((b - 56) / 8) * 0.12, fx: 500, fy: 260 });
      const since = bt(b - cur[0]);
      flash(0.5 - since * 6);
      screenT();
      caption('PICK YOUR COURT', 110, 150, bt(b - 56.2), bt(3.5), 64);
      const names: Record<Backdrop, string> = { plain: 'PLAIN', gym: 'GYM', street: 'STREET', notebook: 'NOTEBOOK' };
      stamp(names[cur[1]], 120, 1000, 72, since, { align: 'left', font: DISPLAY, weight: '400', fill: PAPER, stroke: 8, shadow: 8, rot: -0.03 });
      if (b >= 60) caption('+ DOT-MATRIX SCOREBOARD', W - 110 - 760, 1000, bt(b - 60), bt(4), 40);
    },
  },
  // 64–72: the buzzer-beater.
  {
    from: 64, to: 72,
    enter() { enterClip(clips.buzzer); trail.length = 0; },
    frame(F, b) {
      const c = clips.buzzer;
      stepClip(c, F);
      if (F === bf(70)) { g.renderer.confetti(); }
      const slowing = g.ball ? 1 - slowScale(g.ball.x, g.ball.y, g.world, g.tick) : 0;
      const rc = rimC(g.world, g.tick);
      const follow = g.ball && b < 70 ? smooth((b - 66.5) / 1.6) : 0;
      const z = b < 70 ? 1 + 0.55 * follow * (0.6 + slowing * 0.6) : 1 + Math.max(0, 0.25 - bt(b - 70) * 0.6);
      const target = g.ball ? { x: lerp(g.ball.x, rc.x, 0.45), y: lerp(g.ball.y, rc.y, 0.45) } : rc;
      const cam = { z, fx: lerp(480, target.x, follow), fy: lerp(270, target.y, follow) };
      drawGame(cam); drawTrail(cam); drawFinger(cam);
      // darken the edges as time runs out
      if (b < 70) {
        o.setTransform(1, 0, 0, 1, 0, 0);
        const vg = o.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
        vg.addColorStop(0, 'rgba(18,18,17,0)'); vg.addColorStop(1, `rgba(18,18,17,${0.45 * smooth((b - 65) / 3)})`);
        o.fillStyle = vg; o.fillRect(0, 0, W, H);
      }
      screenT();
      if (b < 70) {
        if (b >= 67) stamp(`0:0${70 - Math.floor(b)}`, W / 2, 230, 190, bt(b - Math.floor(b)), { font: DISPLAY, weight: '400', fill: PAPER, stroke: 12, shadow: 12 });
        else caption('LAST SHOT. 3 SECONDS.', W / 2, 160, bt(b - 64.2), bt(2.6), 56, 'center');
      }
      if (b >= 70) flash(1 - bt(b - 70) * 5);
      burst('BUZZER BEATER!', 760, 470, bt(b - 70), 1.05, -0.08, 60);
      if (b >= 70.6) {
        o.save(); o.translate(1560, 200); o.rotate(0.12);
        const t = bt(b - 70.6), k = Math.min(1, t / 0.12), s = 2.2 - 1.2 * k * k;
        o.scale(s, s); o.globalAlpha = Math.min(1, t / 0.05);
        o.fillStyle = INK; o.fillRect(-190 + 10, -54 + 10, 380, 108);
        o.fillStyle = ACCENT; o.fillRect(-190, -54, 380, 108); o.lineWidth = 6; o.strokeStyle = INK; o.strokeRect(-190, -54, 380, 108);
        o.fillStyle = PAPER; o.font = `400 76px ${DISPLAY}`; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText('NEW BEST', 0, 4);
        o.restore();
      }
    },
  },
  // 72–80: end card.
  {
    from: 72, to: 80,
    enter() { enterClip({ backdrop: 'plain', px: 470 }); },
    frame(F, b) {
      paper();
      o.setTransform(1, 0, 0, 1, shakeX, shakeY);
      // the mark drops and bounces on beat 62.5
      const mt = bt(b - 72), land = bt(0.5);
      const k = Math.min(1, mt / land);
      let y = lerp(-300, 380, k * k);
      if (mt > land) y -= Math.abs(Math.sin((mt - land) * 7)) * 60 * Math.exp(-(mt - land) * 4);
      const sq = mt > land ? 1 - Math.sin(Math.min(1, (mt - land) / 0.2) * Math.PI) * 0.16 : 1;
      o.save(); o.translate(W / 2, y); o.scale(1 / sq, sq); o.drawImage(markImg, -150, -300, 300, 300); o.restore();
      stamp('STICK HOOPS', W / 2, 520, 140, bt(b - 73), { weight: '700' });
      const u = smooth((b - 73.4) / 0.8);
      if (u > 0) {
        o.strokeStyle = INK; o.lineCap = 'round';
        o.lineWidth = 12; o.beginPath(); o.moveTo(W / 2 - 520, 560); o.lineTo(lerp(W / 2 - 520, W / 2 + 500, u), 556); o.stroke();
        o.lineWidth = 4; o.beginPath(); o.moveTo(W / 2 - 500, 576); o.lineTo(lerp(W / 2 - 500, W / 2 + 520, u), 574); o.stroke();
      }
      const tag = 'Pull back. Let go. Swish.';
      const shown = Math.floor(clamp((b - 74) / 1.6) * tag.length);
      o.font = `400 46px ${MONO}`; o.fillStyle = MUTE; o.textAlign = 'center'; o.textBaseline = 'alphabetic';
      o.fillText(tag.slice(0, shown) + (shown < tag.length && shown > 0 && F % 10 < 5 ? '▍' : ''), W / 2, 660);
      ['6 MODES', '2 PLAYERS', 'NO SIGN-UP', 'PLAYS OFFLINE'].forEach((s, i) => {
        const t = bt(b - (75.8 + i * 0.5));
        if (t < 0) return;
        o.save();
        o.font = `700 30px ${MONO}`; const w = o.measureText(s).width + 44;
        const x = W / 2 - 720 + i * 370 + 175;
        o.translate(x, 770); const kk = backOut(Math.min(1, t / 0.25)); o.scale(kk, kk);
        o.fillStyle = INK; o.fillRect(-w / 2 + 6, -30 + 6, w, 60);
        o.fillStyle = PAPER; o.lineWidth = 4; o.strokeStyle = INK; o.fillRect(-w / 2, -30, w, 60); o.strokeRect(-w / 2, -30, w, 60);
        o.fillStyle = INK; o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillText(s, 0, 2);
        o.restore();
      });
      o.setTransform(1, 0, 0, 1, 0, 0);
      caption(`PLAY FREE  →  ${SITE}`, W / 2, 925, bt(b - 77.6), bt(10), 52, 'center');
      // fade to paper at the very end
      flash(smooth((b - 79.3) / 0.7));
    },
  },
];

function wrap(text: string, width: number): string[] {
  const words = text.split(' '), lines: string[] = [];
  let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (o.measureText(t).width > width && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  return lines;
}

let scratchCanvas: HTMLCanvasElement | null = null;
function scratch(): HTMLCanvasElement {
  if (!scratchCanvas) { scratchCanvas = document.createElement('canvas'); scratchCanvas.width = W; scratchCanvas.height = H; }
  return scratchCanvas;
}
/** Run the drawing helpers (which draw on `o`) against another context. */
function ctxSwap(c: CanvasRenderingContext2D, fn: () => void): void {
  const keep = o;
  o = c;
  try { fn(); } finally { o = keep; }
}

// ---------- frames ----------
let sceneIdx = -1;
const timeline: number[] = [];

function frame(F: number): void {
  clock = F / FPS;
  const b = clock / SPB;
  const si = scenes.findIndex((s) => b >= s.from && b < s.to);
  if (si !== sceneIdx) { sceneIdx = si; scenes[si]?.enter?.(); }
  // shake
  trauma = Math.max(0, trauma - 2.2 / FPS) + (shakeAt.get(F) ?? 0);
  const tr = Math.min(1, trauma) ** 2;
  shakeX = (fx() - 0.5) * 70 * tr; shakeY = (fx() - 0.5) * 70 * tr; shakeR = (fx() - 0.5) * 0.03 * tr;
  o.setTransform(1, 0, 0, 1, 0, 0);
  scenes[si]?.frame(F, b);
  // hard cuts inside the montage: two frames of ink, then the next play
  for (const cb of cuts) { const d = F - bf(cb); if (d >= 0 && d < 2) flash(1, INK); else if (d >= 2 && d < 5) flash(0.6 - (d - 2) * 0.2); }
  // scribble wipes between scenes
  for (const wb of wipes) {
    const wf = bf(wb), d = F - wf;
    if (d < -7 || d >= 7) continue;
    if (!wipePts.has(wb)) wipePts.set(wb, scribblePath(9, wb * 13, 200));
    const pts = wipePts.get(wb)!;
    o.setTransform(1, 0, 0, 1, 0, 0); o.strokeStyle = INK;
    if (d < 0) strokePath(pts, 0, smooth((d + 7) / 7), 330);
    else strokePath(pts, smooth(d / 7), 1, 330);
  }
  // paper grain over everything
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalAlpha = 0.07; o.globalCompositeOperation = 'multiply';
  o.drawImage(grain, -Math.floor(fx() * 64), -Math.floor(fx() * 64));
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  timeline.push(F);
}

// ---------- soundtrack ----------
function cues(): void {
  // opening scratch, title stamps, wipes
  cue('x:scratch', 0.4, bt(4.6));
  let n = 0;
  for (const ch of 'STICK HOOPS') { if (ch === ' ') continue; cue('x:stamp', 8 + n * 0.5); addShake(8 + n * 0.5, 0.35); n++; }
  cue('x:scratch', 13, bt(0.8));
  cue('x:whoosh', 13.3); cue('swish', 14); cue('net', 14.05); addShake(14, 0.5);
  for (const s2 of [14, 14.5, 15]) cue('x:stamp', s2);
  for (const w of wipes) cue('x:whoosh', w - 7 / 15);
  for (const c of cuts) cue('x:cut', c);
  for (const c of [clips.swish, clips.bank, clips.wall, clips.elevator]) { addShake(c.at, 0.55); cue('x:hit', c.at); }
  for (let i = 0; i < 6; i++) cue('x:pop', 41 + i * 0.85, i);
  for (let i = 0; i < 5; i++) { cue('x:slam', 51.5 + i * 0.5); addShake(51.5 + i * 0.5, 0.45); }
  for (let b = 56; b < 62; b++) cue('x:shutter', b);
  for (const b of [62, 62.5, 63, 63.25, 63.5, 63.75]) cue('x:shutter', b);
  for (const b of [64, 65, 66]) cue('x:heart', b);
  for (const b of [67, 68, 69]) { cue('x:tick', b); cue('x:heart', b); addShake(b, 0.25); }
  cue('buzzer', 70); cue('fanfare', 70.3); addShake(70, 1.1); addShake(70.6, 0.4); cue('x:stamp', 70.6);
  cue('x:land', 72.5); addShake(72.5, 0.4); cue('x:stamp', 73);
  for (let i = 0; i < 4; i++) cue('x:pop', 75.8 + i * 0.5, i + 1);
}

async function audio(): Promise<string> {
  const SR = 48000, LEN = bt(BEATS) + 1.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * LEN), SR);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  const master = ctx.createGain(); master.gain.value = 0.9;
  comp.connect(master).connect(ctx.destination);
  const music = ctx.createGain(); music.gain.value = 0.8; music.connect(comp);
  const fxBus = ctx.createGain(); fxBus.gain.value = 0.8; fxBus.connect(comp);
  const gameBus = ctx.createGain(); gameBus.gain.value = 1.0; gameBus.connect(comp);

  const noiseBuf = ctx.createBuffer(1, SR * 2, SR);
  { const d = noiseBuf.getChannelData(0); const r = prng(99); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }

  const env = (gn: GainNode, t: number, a: number, peak: number, dec: number) => {
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  };
  const tone = (dest: AudioNode, t: number, f: number, type: OscillatorType, peak: number, dec: number, o2: { to?: number; a?: number; pan?: number; lp?: number } = {}) => {
    const osc = ctx.createOscillator(), gn = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    if (o2.to) osc.frequency.exponentialRampToValueAtTime(o2.to, t + (o2.a ?? 0.003) + dec);
    env(gn, t, o2.a ?? 0.003, peak, dec);
    let node: AudioNode = osc.connect(gn);
    if (o2.lp) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o2.lp; node = node.connect(f2); }
    if (o2.pan) { const p = ctx.createStereoPanner(); p.pan.value = o2.pan; node = node.connect(p); }
    node.connect(dest);
    osc.start(t); osc.stop(t + (o2.a ?? 0.003) + dec + 0.05);
  };
  const noise = (dest: AudioNode, t: number, peak: number, dec: number, o2: { type?: BiquadFilterType; f?: number; to?: number; q?: number; a?: number; pan?: number } = {}) => {
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; flt.type = o2.type ?? 'bandpass'; flt.frequency.setValueAtTime(o2.f ?? 1000, t);
    if (o2.to) flt.frequency.exponentialRampToValueAtTime(o2.to, t + (o2.a ?? 0.003) + dec);
    flt.Q.value = o2.q ?? 1;
    env(gn, t, o2.a ?? 0.003, peak, dec);
    let node: AudioNode = src.connect(flt).connect(gn);
    if (o2.pan) { const p = ctx.createStereoPanner(); p.pan.value = o2.pan; node = node.connect(p); }
    node.connect(dest);
    src.start(t, fx() * 1.0); src.stop(t + (o2.a ?? 0.003) + dec + 0.05);
  };

  // instruments
  const kick = (t: number, v = 1, big = false) => { tone(music, t, big ? 130 : 155, 'sine', 0.95 * v, big ? 0.9 : 0.36, { to: 40 }); tone(music, t, 2200, 'triangle', 0.08 * v, 0.012); if (big) tone(music, t, 55, 'sine', 0.6 * v, 1.4); };
  const snare = (t: number, v = 1) => { noise(music, t, 0.5 * v, 0.17, { f: 1900, q: 0.7 }); noise(music, t, 0.25 * v, 0.09, { type: 'highpass', f: 5000 }); tone(music, t, 200, 'triangle', 0.3 * v, 0.07, { to: 150 }); };
  const clap = (t: number, v = 1) => { for (const d of [0, 0.011, 0.023]) noise(music, t + d, 0.35 * v, d === 0.023 ? 0.14 : 0.02, { f: 1500, q: 1.4 }); };
  const hat = (t: number, v = 1, open = false) => noise(music, t, 0.18 * v, open ? 0.24 : 0.035, { type: 'highpass', f: 7200, pan: 0.25 });
  const bass = (t: number, f: number, d: number, v = 1) => { tone(music, t, f, 'sawtooth', 0.32 * v, d, { lp: 320, a: 0.006 }); tone(music, t, f, 'sine', 0.35 * v, d * 1.1); };
  const pluck = (t: number, fs: number[], v = 1) => fs.forEach((f, i) => { tone(music, t + i * 0.012, f, 'triangle', 0.11 * v, 0.55, { lp: 2600, pan: (i - 1.5) * 0.25 }); tone(music, t + i * 0.012, f * 2, 'sine', 0.025 * v, 0.4); });
  const pad = (t: number, d: number, fs: number[], v = 1, cutoff = 900) => fs.forEach((f) => {
    for (const det of [-6, 6]) {
      const osc = ctx.createOscillator(), gn = ctx.createGain(), lp = ctx.createBiquadFilter();
      osc.type = 'sawtooth'; osc.frequency.value = f; osc.detune.value = det;
      lp.type = 'lowpass'; lp.frequency.value = cutoff;
      gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.028 * v, t + Math.min(1, d / 3)); gn.gain.setValueAtTime(0.028 * v, t + d * 0.7); gn.gain.linearRampToValueAtTime(0.0001, t + d);
      osc.connect(lp).connect(gn).connect(music); osc.start(t); osc.stop(t + d + 0.1);
    }
  });
  const crash = (t: number, v = 1) => { noise(music, t, 0.32 * v, 2.2, { type: 'highpass', f: 4200 }); noise(music, t, 0.15 * v, 1.2, { f: 9000, q: 0.6 }); };
  const riser = (t: number, d: number) => {
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; flt.type = 'bandpass'; flt.Q.value = 2.5;
    flt.frequency.setValueAtTime(300, t); flt.frequency.exponentialRampToValueAtTime(7000, t + d);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.3, t + d); gn.gain.linearRampToValueAtTime(0.0001, t + d + 0.02);
    src.connect(flt).connect(gn).connect(music); src.start(t); src.stop(t + d + 0.05);
    tone(music, t, 110, 'sawtooth', 0.06, d, { to: 880, a: d * 0.9, lp: 1800 });
  };
  const swell = (t: number, d: number) => {
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; flt.type = 'highpass'; flt.frequency.value = 2500;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.35, t + d); gn.gain.linearRampToValueAtTime(0.0001, t + d + 0.01);
    src.connect(flt).connect(gn).connect(music); src.start(t); src.stop(t + d + 0.05);
  };

  // custom effects
  const X: Record<string, (t: number, ...a: unknown[]) => void> = {
    scratch: (t, d) => {
      const dur = d as number, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
      src.buffer = noiseBuf; src.loop = true; flt.type = 'bandpass'; flt.frequency.value = 3200; flt.Q.value = 1.1;
      gn.gain.setValueAtTime(0.0001, t);
      const r = prng(Math.round(t * 1000));
      for (let s = t; s < t + dur; s += 0.045 + r() * 0.05) { gn.gain.linearRampToValueAtTime(0.05 + r() * 0.17, s + 0.012); gn.gain.linearRampToValueAtTime(0.01, s + 0.04); }
      gn.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
      src.connect(flt).connect(gn).connect(fxBus); src.start(t); src.stop(t + dur + 0.1);
    },
    stamp: (t) => { tone(fxBus, t, 115, 'sine', 0.75, 0.16, { to: 48 }); noise(fxBus, t, 0.45, 0.06, { type: 'lowpass', f: 1300 }); noise(fxBus, t, 0.14, 0.03, { type: 'highpass', f: 2500 }); },
    slam: (t) => { tone(fxBus, t, 90, 'sine', 0.9, 0.3, { to: 38 }); noise(fxBus, t, 0.55, 0.12, { type: 'lowpass', f: 900 }); noise(fxBus, t, 0.2, 0.25, { f: 3000, q: 0.5 }); },
    whoosh: (t) => noise(fxBus, t, 0.32, 0.42, { f: 350, to: 3600, q: 1.6, a: 0.12 }),
    hit: (t) => { tone(fxBus, t, 70, 'sine', 0.7, 0.5, { to: 35 }); noise(fxBus, t, 0.25, 0.9, { type: 'highpass', f: 3500 }); },
    pop: (t, i) => { const scale = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98]; const f = scale[(i as number) % 6]; tone(fxBus, t, f, 'triangle', 0.16, 0.3); tone(fxBus, t, f * 2, 'sine', 0.05, 0.25); noise(fxBus, t, 0.12, 0.04, { type: 'lowpass', f: 1000 }); },
    shutter: (t) => { noise(fxBus, t, 0.28, 0.025, { type: 'highpass', f: 3000 }); noise(fxBus, t + 0.04, 0.2, 0.02, { type: 'highpass', f: 2200 }); tone(fxBus, t, 1800, 'square', 0.03, 0.01); },
    tick: (t) => { tone(fxBus, t, 2100, 'triangle', 0.22, 0.03); tone(fxBus, t + 0.25, 1500, 'triangle', 0.12, 0.03); },
    heart: (t) => { tone(fxBus, t, 60, 'sine', 0.7, 0.18, { to: 40 }); tone(fxBus, t + 0.17, 55, 'sine', 0.45, 0.2, { to: 38 }); },
    cut: (t) => { noise(fxBus, t, 0.35, 0.05, { type: 'lowpass', f: 2000 }); tone(fxBus, t, 95, 'sine', 0.5, 0.12, { to: 50 }); },
    land: (t) => { tone(fxBus, t, 120, 'sine', 0.6, 0.15, { to: 55 }); noise(fxBus, t, 0.2, 0.04, { type: 'lowpass', f: 900 }); },
  };

  // ---- the arrangement (beats) ----
  const at = (b: number) => bt(b);
  const E = [82.41, 65.41, 98.0, 73.42]; // E2 C2 G2 D2
  const CH = [[164.81, 196, 246.94, 293.66], [130.81, 164.81, 196, 246.94], [196, 246.94, 293.66, 329.63], [146.83, 220, 293.66, 369.99]];
  const sw = 0.06; // swing on the off-beats
  // vinyl crackle under everything: soft hiss plus random clicks
  {
    const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), gn = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true; flt.type = 'bandpass'; flt.frequency.value = 3000; flt.Q.value = 0.4; gn.gain.value = 0.012;
    src.connect(flt).connect(gn).connect(music); src.start(0); src.stop(bt(BEATS));
    const r = prng(5);
    for (let t = 0.1; t < bt(BEATS); t += 0.02 + r() * 0.18) noise(music, t, 0.03 + r() * 0.08, 0.004, { type: 'highpass', f: 2000 });
  }
  // 0–8 intro: a pad, then a soft pulse
  pad(at(0), bt(8.5), CH[0], 0.9, 600);
  for (let b = 4; b < 8; b++) { kick(at(b), 0.45); hat(at(b + 0.5 + sw), 0.6); }
  // 8–16 title
  for (let b = 8; b < 16; b++) { hat(at(b + 0.5 + sw), 0.7); if (b % 2 === 0) kick(at(b), 0.7); else snare(at(b), 0.6); }
  for (let b = 12; b < 16; b++) bass(at(b), E[0], 0.4, 0.7);
  pad(at(8), bt(8), CH[0], 0.7, 900);
  // 16–56 the groove: ten bars of boom-bap
  for (let bar = 0; bar < 10; bar++) {
    const b0 = 16 + bar * 4, ci = bar % 4;
    for (const k of [0, 0.75, 2.5]) { kick(at(b0 + k)); bass(at(b0 + k), E[ci], k === 2.5 ? 0.6 : 0.35); }
    bass(at(b0 + 3.5), E[ci] * 1.5, 0.2, 0.7);
    snare(at(b0 + 1)); snare(at(b0 + 3)); snare(at(b0 + 3.75), 0.25);
    for (let e = 0; e < 8; e++) hat(at(b0 + e * 0.5 + (e % 2 ? sw : 0)), e % 2 ? 0.7 : 1, e === 7);
    pluck(at(b0), CH[ci]); pluck(at(b0 + 2.5), CH[ci], 0.7);
    // a chord bed under every bar, brighter while the six modes pop in
    pad(at(b0), bt(4) + 0.05, CH[ci], bar === 6 || bar === 7 ? 1.1 : 0.85, bar === 6 || bar === 7 ? 1500 : 1000);
    for (let s16 = 0; s16 < 16; s16++) if (s16 % 4) noise(music, at(b0 + s16 / 4 + (s16 % 2 ? sw / 2 : 0)), 0.035, 0.03, { type: 'bandpass', f: 6000, q: 1.5, pan: -0.3 });
  }
  // 56–64 build
  for (let b = 56; b < 64; b++) {
    kick(at(b), b < 62 ? 0.9 : 1);
    if (b % 2 === 1) clap(at(b));
    bass(at(b), E[0], 0.2); bass(at(b + 0.5), E[0] * 2, 0.15, 0.6);
    const div = b < 60 ? 2 : 4;
    for (let s2 = 0; s2 < div; s2++) hat(at(b + s2 / div), 0.8);
  }
  pluck(at(56), CH[0]); pluck(at(58), CH[1]); pluck(at(60), CH[2]); pluck(at(62), CH[3]);
  riser(at(60), bt(4));
  for (let s2 = 0; s2 < 8; s2++) snare(at(62 + s2 * 0.25), 0.3 + s2 * 0.05);
  for (let s2 = 0; s2 < 8; s2++) snare(at(63 + s2 * 0.125), 0.5 + s2 * 0.05);
  // 64–70 the break: heartbeat and clock (cued), a held low note, then a swell into the shot
  pad(at(64), bt(6), [82.41, 123.47], 0.8, 380);
  swell(at(69), bt(1));
  // 70–72 the drop
  kick(at(70), 1, true); crash(at(70)); pluck(at(70), CH[0], 1.4); bass(at(70), E[0], 0.9);
  for (let b = 70; b < 72; b++) { if (b > 70) kick(at(b)); snare(at(b + 1)); for (let s2 = 0; s2 < 4; s2++) hat(at(b + s2 * 0.25), 0.9, s2 === 2); }
  kick(at(70.75)); kick(at(71.5));
  // 72–80 outro
  kick(at(72), 0.9); crash(at(72), 0.6);
  pad(at(72), bt(8), [164.81, 246.94, 293.66, 369.99, 493.88], 0.9, 1400);
  bass(at(72), E[0], 2.5, 0.8);
  [659.25, 587.33, 493.88, 392.0, 493.88].forEach((f, i) => { tone(music, at(73 + i), f, 'triangle', 0.09, 0.9, { lp: 3000 }); tone(music, at(73 + i), f * 2, 'sine', 0.03, 0.7); });
  tone(music, at(78), 1318.51, 'sine', 0.06, 2.5);

  // game sounds and cues
  sfxOffline.attach(ctx, gameBus, 0.75);
  for (const e of evs) {
    if (e.name.startsWith('x:')) { X[e.name.slice(2)]?.(e.t, ...e.args); continue; }
    const f = real[e.name];
    if (!f) continue;
    sfxOffline.at(e.t);
    f(...e.args);
  }

  const buf = await ctx.startRendering();
  return wavBase64(buf);
}

function wavBase64(buf: AudioBuffer): string {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o2: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o2 + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, sr, true);
  data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); str(36, 'data'); data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, i) => buf.getChannelData(i));
  let peak = 0;
  for (const c of chans) for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(c[i]));
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  let p = 44;
  for (let i = 0; i < len; i++) for (const c of chans) { data.setInt16(p, Math.max(-1, Math.min(1, c[i] * gain)) * 32767, true); p += 2; }
  const bytes = new Uint8Array(data.buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// ---------- API for the renderer script ----------
async function setup(): Promise<void> {
  await document.fonts.load(`400 100px ${DISPLAY}`);
  await document.fonts.load(`700 100px ${MONO}`);
  markImg = await svgImage(MARK, 600);
  for (const m of MODES) iconImg[m.id] = await svgImage(icon(m.id, ''), 168);
  makeGrain();
  for (const c of allClips) plan(c);
  cues();
}

async function frameData(F: number, type = 'image/png'): Promise<string> {
  frame(F);
  return out.toDataURL(type).split(',')[1];
}

(window as unknown as Record<string, unknown>).trailer = {
  N, FPS, setup, frame, frameData, audio,
  plans: () => allClips.map((c) => ({ start: c.start, at: c.at, launchF: c.launchF, swish: c.r?.swish, bank: c.r?.bank, offWall: c.r?.offWall, rimOut: c.r?.rimOut })),
  events: () => evs.length,
};
