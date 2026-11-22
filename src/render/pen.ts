// Drawing helpers shared by the renderer: theme colours, the ink "boil" wobble, limbs.

export interface Colors {
  paper: string;
  ink: string;
  mute: string;
  faint: string;
}

export function readColors(): Colors {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return { paper: v('--paper'), ink: v('--ink'), mute: v('--mute'), faint: v('--faint') };
}

type P = { x: number; y: number };

export class Pen {
  c: Colors;
  /** Hand-drawn wobble; only the figure uses it so the rest of the court stays still. */
  boil = false;
  private seed = 0;
  private n = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(readonly ctx: CanvasRenderingContext2D) {
    this.c = readColors();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => (this.c = readColors()));
    new MutationObserver(() => (this.c = readColors())).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  /** Call once per frame: the wobble changes ~7 times a second, like a flipbook. */
  frame(time: number): void {
    this.seed = Math.floor(time * 7);
    this.n = 0;
  }

  jit(): number {
    if (this.reduced || !this.boil) return 0;
    this.n++;
    const s = Math.sin(this.seed * 131.1 + this.n * 17.37) * 43758.5453;
    return (s - Math.floor(s) - 0.5) * 1.1;
  }

  seg(a: P, b: P): void {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(a.x + this.jit(), a.y + this.jit());
    c.lineTo(b.x + this.jit(), b.y + this.jit());
    c.stroke();
    if (this.boil) {
      // A second, fainter pencil pass slightly off the first, like a sketch gone over twice.
      const w = c.lineWidth, al = c.globalAlpha;
      c.lineWidth = w * 0.45; c.globalAlpha = al * 0.4;
      c.beginPath();
      c.moveTo(a.x + 1.2 + this.jit(), a.y - 0.8 + this.jit());
      c.lineTo(b.x + 1.2 + this.jit(), b.y - 0.8 + this.jit());
      c.stroke();
      c.lineWidth = w; c.globalAlpha = al;
    }
  }

  /** Two-bone limb from A toward T. `sign` picks which way the joint bends. */
  limb(A: P, T: P, sign: number, l = 22): void {
    const dx = T.x - A.x, dy = T.y - A.y;
    const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), 2 * l - 0.01));
    const a = Math.atan2(dy, dx);
    const c = Math.acos(Math.max(-1, Math.min(1, d / (2 * l))));
    const E = { x: A.x + Math.cos(a + sign * c) * l, y: A.y + Math.sin(a + sign * c) * l };
    const Tn = { x: A.x + Math.cos(a) * d, y: A.y + Math.sin(a) * d };
    this.seg(A, E);
    this.seg(E, Tn);
  }

  ball(x: number, y: number, rot: number, sq: number, R: number): void {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (sq) { c.translate(0, R * sq * 0.35); c.scale(1 + 0.4 * sq, 1 - 0.4 * sq); }
    c.rotate(rot);
    c.fillStyle = this.c.paper; c.strokeStyle = this.c.ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    // Shading: hatch the whole ball, then lay paper back over the lit side (upper left),
    // leaving a hatched crescent on the lower right. Done before rotating, so the light stays put.
    c.save();
    c.rotate(-rot);
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
    c.lineWidth = 0.8; c.globalAlpha = 0.7; c.beginPath();
    for (let k = -2 * R; k <= 2 * R; k += 3.4) { c.moveTo(k - R, -R); c.lineTo(k + R, R); }
    c.stroke();
    c.globalAlpha = 1; c.fillStyle = this.c.paper;
    c.beginPath(); c.arc(-R * 0.34, -R * 0.36, R * 1.02, 0, Math.PI * 2); c.fill();
    c.restore();
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.moveTo(0, -R); c.lineTo(0, R); c.stroke();
    c.beginPath(); c.arc(-R * 1.15, 0, R * 0.75, -1, 1); c.stroke();
    c.beginPath(); c.arc(R * 1.15, 0, R * 0.75, Math.PI - 1, Math.PI + 1); c.stroke();
    c.restore();
  }
}
