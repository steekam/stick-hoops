import { store } from '../storage';

// Every sound is synthesized with Web Audio: no files to load. Browsers only allow audio after
// the player interacts, so the context is created on the first tap or key press (see resume()).

let ac: BaseAudioContext | null = null;
/** Offline rendering (the trailer): sounds are scheduled at `when` instead of "now". */
let offline = false;
let when = 0;
let master: GainNode;
let noiseBuf: AudioBuffer;
let on = store.get('sound', true);

function init(): void {
  if (ac) return;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ac = new Ctor();
    master = ac.createGain();
    master.gain.value = 0.6;
    master.connect(ac.destination);
    const n = ac.sampleRate;
    noiseBuf = ac.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ac = null;
  }
}

const ready = (): boolean => !!ac && (offline || (on && ac.state === 'running'));
const now = (): number => (offline ? when : ac!.currentTime);

/**
 * Render the game's sounds into an OfflineAudioContext instead of the speakers. Used by the
 * trailer (promo/) so its soundtrack is the real game audio. Call at(t) before each sound.
 */
export const sfxOffline = {
  attach(ctx: OfflineAudioContext, dest: AudioNode, gain = 0.6): void {
    ac = ctx;
    offline = true;
    master = ctx.createGain();
    master.gain.value = gain;
    master.connect(dest);
    const n = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, n, n);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  },
  at(t: number): void { when = t; },
};

function env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

interface ToneOpts { to?: number; delay?: number; a?: number }
function tone(f: number, type: OscillatorType, peak: number, dec: number, o: ToneOpts = {}): void {
  if (!ready() || !ac) return;
  const t = now() + (o.delay ?? 0), a = o.a ?? 0.004;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + a + dec);
  env(g, t, a, peak, dec);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + a + dec + 0.05);
}

interface NoiseOpts { type?: BiquadFilterType; f?: number; to?: number; q?: number; delay?: number; a?: number }
function noise(peak: number, dec: number, o: NoiseOpts = {}): void {
  if (!ready() || !ac) return;
  const t = now() + (o.delay ?? 0), a = o.a ?? 0.004;
  const src = ac.createBufferSource(), bf = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  bf.type = o.type ?? 'bandpass';
  bf.frequency.setValueAtTime(o.f ?? 1000, t);
  if (o.to) bf.frequency.exponentialRampToValueAtTime(o.to, t + a + dec);
  bf.Q.value = o.q ?? 1;
  env(g, t, a, peak, dec);
  src.connect(bf).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + a + dec + 0.05);
}

export const sfx = {
  /** Call from any user gesture; safe to call repeatedly. */
  resume(): void {
    init();
    if (ac && !offline && ac.state !== 'running') (ac as AudioContext).resume().catch(() => {});
  },
  get on(): boolean {
    return on;
  },
  toggle(): boolean {
    on = !on;
    store.set('sound', on);
    if (on) this.resume();
    return on;
  },
  bounce(v = 0.6) { tone(115, 'sine', 0.45 * v + 0.05, 0.13, { to: 55 }); noise(0.12 * v, 0.035, { type: 'lowpass', f: 900 }); },
  release() { noise(0.07, 0.2, { f: 500, to: 1800, q: 0.8, a: 0.03 }); },
  rim(v: number) {
    const p = 0.1 + 0.18 * Math.min(1, v / 500);
    for (const [f, m] of [[620, 1], [1190, 0.55], [1740, 0.35]]) tone(f * (1 + Math.random() * 0.02), 'triangle', p * m, 0.28);
    noise(p * 0.5, 0.04, { type: 'highpass', f: 2500 });
  },
  board(v: number) { const p = 0.12 + 0.25 * Math.min(1, v / 500); tone(160, 'sine', p, 0.11, { to: 85 }); noise(p * 0.6, 0.05, { f: 700, q: 1.5 }); },
  swish() { noise(0.22, 0.3, { type: 'highpass', f: 2400, to: 5200, a: 0.02 }); },
  net() { noise(0.12, 0.18, { type: 'highpass', f: 2000, a: 0.01 }); },
  make() { tone(660, 'triangle', 0.1, 0.12, { delay: 0.05 }); tone(990, 'triangle', 0.1, 0.2, { delay: 0.14 }); },
  cheer() { noise(0.1, 1.1, { f: 1200, q: 0.6, a: 0.15 }); },
  ooh() { noise(0.09, 0.8, { f: 600, to: 380, q: 4, a: 0.12 }); noise(0.05, 0.8, { f: 1100, to: 800, q: 5, a: 0.12 }); },
  buzzer() { tone(200, 'square', 0.1, 0.6, { a: 0.01 }); tone(203, 'square', 0.07, 0.6, { a: 0.01 }); },
  clear() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 'triangle', 0.13, 0.25, { delay: i * 0.09 })); },
  fail() { tone(392, 'triangle', 0.12, 0.22); tone(294, 'triangle', 0.12, 0.35, { delay: 0.18 }); },
  /** New personal best: a bright arpeggio over a cheer. */
  fanfare() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 'triangle', 0.12, i === 4 ? 0.6 : 0.16, { delay: i * 0.075 }));
    tone(1568, 'sine', 0.05, 0.7, { delay: 0.38 });
    noise(0.12, 1.4, { f: 1300, q: 0.6, a: 0.2, delay: 0.1 });
  },
  /** Pause and resume: a soft two-note blip, down then up. */
  pause(on: boolean) { tone(on ? 520 : 390, 'triangle', 0.07, 0.07); tone(on ? 390 : 520, 'triangle', 0.07, 0.09, { delay: 0.07 }); },
  /** Short UI tick, for menus. */
  click() { tone(880, 'triangle', 0.05, 0.05); },
  /** Rising whoosh for a power-up being armed (Sabotage). */
  zap() { tone(300, 'sawtooth', 0.06, 0.25, { to: 1200 }); noise(0.05, 0.25, { f: 800, to: 3000, q: 2 }); },
};
