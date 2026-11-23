import { describe, expect, it } from 'vitest';
import { apply, clampTo, ease, fit, focusView, toWorld, type View } from '../src/render/camera';

const rect = { left: 10, top: 20, width: 390, height: 700 };

// A canvas stand-in that records the transform apply() sets.
function recorder() {
  let m: number[] = [1, 0, 0, 1, 0, 0];
  const ctx = { setTransform: (...a: number[]) => { m = a; } } as unknown as CanvasRenderingContext2D;
  return { ctx, get m() { return m; } };
}
const forward = (m: number[], x: number, y: number) => ({ x: m[0] * x + m[4], y: m[3] * y + m[5] });

describe('camera', () => {
  it('toWorld inverts apply (uniform and stretched)', () => {
    for (const view of [{ x: 120, y: -300, w: 700, h: 1253 }, { x: 0, y: 0, w: 960, h: 540 }]) {
      const canvas = { width: rect.width * 2, height: rect.height * 2 }; // dpr 2
      const r = recorder();
      apply(r.ctx, view, canvas);
      for (const [px, py] of [[0, 0], [195, 350], [390, 700], [57, 611]]) {
        const w = toWorld(view, rect, rect.left + px, rect.top + py);
        const s = forward(r.m, w.x, w.y);
        expect(s.x).toBeCloseTo(px * 2, 6);
        expect(s.y).toBeCloseTo(py * 2, 6);
      }
    }
  });

  it('the full-court view is exactly the old stretch transform', () => {
    const r = recorder();
    apply(r.ctx, { x: 0, y: 0, w: 960, h: 540 }, { width: 1040, height: 585 });
    expect(r.m[0]).toBe(1040 / 960);
    expect(r.m[3]).toBe(585 / 540);
    expect(r.m[4] + 0).toBe(0);
    expect(r.m[5] + 0).toBe(0);
  });

  it('fit contains the target at the canvas aspect, centred', () => {
    const t: View = { x: 220, y: 100, w: 720, h: 440 };
    for (const [cw, ch] of [[390, 700], [700, 400], [1000, 1000]]) {
      const v = fit(t, cw, ch);
      expect(v.w / v.h).toBeCloseTo(cw / ch, 9);
      expect(v.x).toBeLessThanOrEqual(t.x + 1e-9);
      expect(v.y).toBeLessThanOrEqual(t.y + 1e-9);
      expect(v.x + v.w).toBeGreaterThanOrEqual(t.x + t.w - 1e-9);
      expect(v.y + v.h).toBeGreaterThanOrEqual(t.y + t.h - 1e-9);
      expect(v.x + v.w / 2).toBeCloseTo(t.x + t.w / 2, 9);
    }
  });

  it('ease converges, never overshoots, and is frame-rate independent', () => {
    const a: View = { x: 0, y: 0, w: 700, h: 1250 }, b: View = { x: 500, y: 200, w: 280, h: 500 };
    let v = a;
    for (let i = 0; i < 600; i++) v = ease(v, b, 1 / 60, 6);
    for (const k of ['x', 'y', 'w', 'h'] as const) expect(v[k]).toBeCloseTo(b[k], 3);
    let slow = a, fast = a;
    for (let i = 0; i < 30; i++) slow = ease(slow, b, 1 / 30, 6);
    for (let i = 0; i < 60; i++) fast = ease(fast, b, 1 / 60, 6);
    expect(slow.x).toBeCloseTo(fast.x, 6);
    expect(slow.w).toBeCloseTo(fast.w, 6);
    let p = a;
    for (let i = 0; i < 200; i++) { p = ease(p, b, 1 / 60, 6); expect(p.w).toBeGreaterThanOrEqual(b.w - 1e-9); }
  });

  it('clampTo keeps a view inside the extent and centres one that is too big', () => {
    const ext: View = { x: -80, y: -420, w: 1120, h: 1020 };
    const c = clampTo({ x: -500, y: 900, w: 300, h: 400 }, ext);
    expect(c.x).toBe(-80);
    expect(c.y).toBe(200);
    const big = clampTo({ x: 0, y: 0, w: 1300, h: 300 }, ext);
    expect(big.x).toBe(-80 + 560 - 650);
    expect(clampTo({ x: 10, y: 10, w: 100, h: 100 }, ext)).toEqual({ x: 10, y: 10, w: 100, h: 100 });
  });

  it('focusView at z=1 is the whole court', () => {
    expect(focusView(480, 270, 1)).toEqual({ x: 0, y: 0, w: 960, h: 540 });
  });
});
