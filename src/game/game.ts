import { sfx } from '../audio/sfx';
import { DT, FLOOR, VMAX } from '../sim/constants';
import { len } from '../sim/math';
import { makeRng, randomSeed, Rng } from '../sim/rng';
import {
  Ball, Launch, launchBall, makeLaunch, shotOver, ShotEvent, stepBall, summarize,
} from '../sim/shot';
import { makeWorld, World } from '../sim/world';
import { Renderer } from '../render/renderer';
import type { FigState, Hud, Mode, OverlayButton } from './types';

export interface Aim {
  v: { x: number; y: number };
  src: 'ptr' | 'key';
  /** Pointer drag start/current, world units (pointer aims only). */
  sx?: number; sy?: number; cx?: number; cy?: number;
}

export interface Shooter {
  x: number;
  /** Walk target. */
  tx: number;
  /** 0 or 1. Player 2 in a duo mode is drawn with a filled head. */
  variant: 0 | 1;
  /** Short name tag drawn above the head, e.g. "P1". Empty for solo. */
  tag: string;
}

/** Hooks the UI layer gives the game. */
export interface GameUi {
  showOverlay(title: string, body: string, buttons: OverlayButton[]): void;
  hideOverlay(): void;
  overlayOpen(): boolean;
  setHud(h: Hud): void;
}

const CHEERS = ['arms', 'dab', 'guns', 'moon', 'arms', 'guns', 'dab'];
const MISSES = ['slump', 'palm', 'kick'];
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class Game {
  world: World = makeWorld();
  /** World ticks since the mode started. The hoop's sway is a function of this. */
  tick = 0;
  /** Real seconds, for animation only. */
  time = 0;
  player: Shooter = { x: 420, tx: 420, variant: 0, tag: '' };
  ball: Ball | null = null;
  launch: Launch | null = null;
  aim: Aim | null = null;
  fig: FigState = { kind: 'idle', t: 0, dir: { x: 0.7, y: -0.7 } };
  /** Seeded per session; modes draw spots and wind from it so a round can be replayed. */
  seed = randomSeed();
  rng: Rng = makeRng(this.seed);
  mode: Mode | null = null;
  /** Set true to show the "pull back" hint; the tutorial and first-run logic control it. */
  showHint = false;
  /** When false, input is ignored (menus, tutorial cards). */
  inputEnabled = true;
  readonly renderer: Renderer;
  private acc = 0;
  private hudKey = '';
  private shotListeners: ((r: ReturnType<typeof summarize>) => void)[] = [];
  private launchListeners: (() => void)[] = [];

  constructor(readonly canvas: HTMLCanvasElement, readonly ui: GameUi) {
    this.renderer = new Renderer(canvas);
  }

  // ---------- modes ----------

  setMode(m: Mode, seed = randomSeed()): void {
    this.mode?.stop?.(this);
    this.mode = m;
    this.seed = seed;
    this.rng = makeRng(seed);
    this.reset();
    m.start(this);
    this.refreshHud(true);
  }

  /** Clear the court back to a plain hoop. Modes call this from start(). */
  reset(): void {
    this.ui.hideOverlay();
    this.world = makeWorld();
    this.tick = 0;
    this.ball = null;
    this.launch = null;
    this.aim = null;
    this.fig = { kind: 'idle', t: 0, dir: this.fig.dir };
    this.player.variant = 0;
    this.player.tag = '';
    this.renderer.clearPops();
  }

  placePlayer(x: number, instant = false): void {
    this.player.tx = x;
    if (instant) this.player.x = x;
  }

  showOverlay(title: string, body: string, buttons: OverlayButton[]): void {
    this.aim = null;
    this.ui.showOverlay(title, body, buttons);
  }

  /** Floating text. By default it ends just left of the backboard so long labels never cross it. */
  pop(text: string, x?: number, y?: number): void {
    if (x == null) this.renderer.pop(text, this.renderer.hoopPos.x + 46, y ?? this.renderer.hoopPos.y - 30, 'right');
    else this.renderer.pop(text, x, y ?? this.renderer.hoopPos.y - 30);
  }

  refreshHud(force = false): void {
    if (!this.mode) return;
    const h = this.mode.hud(this);
    const key = `${h.left}\u0000${h.mid}\u0000${h.right}\u0000${h.rightNote ?? ''}`;
    if (!force && key === this.hudKey) return;
    this.hudKey = key;
    this.ui.setHud(h);
  }

  /** Listen to every finished shot (tutorial, stats). Returns an unsubscribe function. */
  onShot(fn: (r: ReturnType<typeof summarize>) => void): () => void {
    this.shotListeners.push(fn);
    return () => (this.shotListeners = this.shotListeners.filter((f) => f !== fn));
  }
  onLaunch(fn: () => void): () => void {
    this.launchListeners.push(fn);
    return () => (this.launchListeners = this.launchListeners.filter((f) => f !== fn));
  }

  // ---------- shooting ----------

  walking(): boolean {
    return Math.abs(this.player.tx - this.player.x) > 1;
  }

  canShoot(): boolean {
    return (
      !!this.mode && this.inputEnabled && !this.ball && !this.ui.overlayOpen() && !this.walking() &&
      this.fig.kind !== 'cheer' && (this.mode.canShoot?.(this) ?? true)
    );
  }

  /** Power 0..1 of the current aim. */
  aimPower(): number {
    return this.aim ? Math.min(len(this.aim.v.x, this.aim.v.y) / VMAX, 1) : 0;
  }

  shoot(vx: number, vy: number): void {
    if (!this.canShoot()) return;
    this.aim = null;
    const l = makeLaunch(this.tick, this.player.x, vx, vy);
    this.launch = l;
    this.ball = launchBall(l);
    const m = len(l.vx, l.vy) || 1;
    this.fig = { kind: 'throw', t: 0, dir: { x: l.vx / m, y: l.vy / m } };
    sfx.release();
    this.mode?.onLaunch?.(this);
    for (const f of this.launchListeners) f();
    this.refreshHud();
  }

  // ---------- loop ----------

  update(dt: number): void {
    this.time += dt;
    const fig = this.fig;
    fig.t += dt;
    const cheerLen = fig.v === 'moon' ? 1.4 : fig.v === 'flip' ? 1.05 : 1.1;
    if ((fig.kind === 'cheer' && fig.t > cheerLen) || (fig.kind === 'slump' && fig.t > 0.9)) this.idle();
    if (fig.kind === 'throw' && !this.ball && fig.t > 0.6) this.idle();
    if (fig.kind === 'cheer' && fig.v === 'moon' && fig.t < 1.2) this.player.x = Math.max(60, this.player.x - 36 * dt);
    if (fig.kind !== 'cheer' && !this.ball && this.walking()) {
      const d = this.player.tx - this.player.x;
      this.player.x += Math.sign(d) * Math.min(Math.abs(d), 340 * dt);
    }
    if (this.ball) this.ball.sq = Math.max(0, this.ball.sq - dt * 6);

    // Fixed-step physics. The world ticks even with no ball so the hoop keeps swaying.
    this.acc += dt;
    const events: ShotEvent[] = [];
    while (this.acc >= DT) {
      this.acc -= DT;
      this.tick++;
      if (this.ball && this.world) {
        stepBall(this.world, this.ball, this.tick, events);
        for (const e of events) this.handleEvent(e);
        events.length = 0;
        if (this.ball && shotOver(this.ball)) this.endShot();
      }
    }
    this.mode?.update?.(this, dt);
    this.renderer.update(dt, this);
    this.refreshHud();
  }

  draw(): void {
    this.renderer.draw(this);
  }

  private idle(): void {
    this.fig = { kind: 'idle', t: 0, dir: this.fig.dir };
  }

  private handleEvent(e: ShotEvent): void {
    switch (e.type) {
      case 'rim': sfx.rim(e.impact); break;
      case 'board': case 'wall': sfx.board(e.impact); break;
      case 'pole': sfx.board(e.impact * 0.7); break;
      case 'floor': sfx.bounce(Math.min(1, e.impact / 700)); break;
      case 'score': {
        if (e.swish) sfx.swish(); else sfx.net();
        sfx.make();
        sfx.cheer();
        this.renderer.netSwing();
        this.fig = { kind: 'cheer', t: 0, v: e.swish && Math.random() < 0.3 ? 'flip' : pick(CHEERS), dir: this.fig.dir };
        this.mode?.onScore?.(this, e.swish);
        break;
      }
    }
  }

  /** Force the next celebration to be a backflip (e.g. every 5th make in a streak). */
  backflip(): void {
    if (this.fig.kind === 'cheer') this.fig.v = 'flip';
  }

  private endShot(): void {
    const b = this.ball!, l = this.launch!;
    const r = summarize(this.world, l, b);
    this.ball = null;
    this.launch = null;
    if (!r.made) {
      this.fig = { kind: 'slump', t: 0, v: pick(MISSES), dir: this.fig.dir };
      if (r.rimOut) sfx.ooh(); // the crowd is gone from the picture, but you still hear it
    }
    this.mode?.onShotEnd(this, r);
    for (const f of this.shotListeners) f(r);
    this.refreshHud();
  }
}

export { FLOOR };
