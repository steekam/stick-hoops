import { sfx } from '../audio/sfx';
import { VMAX } from '../sim/constants';
import { clamp } from '../sim/math';
import type { Game } from './game';

/** Slingshot aiming: press, pull back away from the hoop, let go. Arrows + space also work. */
export function attachInput(g: Game): void {
  const cv = g.canvas;
  const PULL = 5.4; // world px of drag → px/s of launch speed
  const MIN = 140; // shorter pulls are treated as a cancel

  cv.addEventListener('pointerdown', (e) => {
    sfx.resume();
    if (!g.canShoot()) return;
    cv.setPointerCapture(e.pointerId);
    const p = g.renderer.toWorld(e.clientX, e.clientY);
    g.aim = { src: 'ptr', sx: p.x, sy: p.y, cx: p.x, cy: p.y, v: { x: 0, y: 0 } };
  });
  cv.addEventListener('pointermove', (e) => {
    const a = g.aim;
    if (!a || a.src !== 'ptr') return;
    const p = g.renderer.toWorld(e.clientX, e.clientY);
    a.cx = p.x; a.cy = p.y;
    let v = { x: (a.sx! - p.x) * PULL, y: (a.sy! - p.y) * PULL };
    const m = Math.hypot(v.x, v.y);
    if (m > VMAX) v = { x: (v.x / m) * VMAX, y: (v.y / m) * VMAX };
    a.v = v;
  });
  cv.addEventListener('pointerup', () => {
    const a = g.aim;
    if (!a || a.src !== 'ptr') return;
    g.aim = null;
    if (Math.hypot(a.v.x, a.v.y) > MIN) g.shoot(a.v.x, a.v.y);
  });
  cv.addEventListener('pointercancel', () => (g.aim = null));

  const key = { ang: -58, pow: 0.62 };
  const keyVec = () => {
    const a = (key.ang * Math.PI) / 180, m = key.pow * VMAX;
    return { x: Math.cos(a) * m, y: Math.sin(a) * m };
  };
  cv.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(k)) return;
    e.preventDefault();
    sfx.resume();
    if (!g.canShoot()) return;
    if (k === 'ArrowLeft') key.ang = clamp(key.ang - 2, -88, -10);
    if (k === 'ArrowRight') key.ang = clamp(key.ang + 2, -88, -10);
    if (k === 'ArrowUp') key.pow = clamp(key.pow + 0.015, 0.15, 1);
    if (k === 'ArrowDown') key.pow = clamp(key.pow - 0.015, 0.15, 1);
    if (k === ' ' || k === 'Enter') {
      if (g.aim?.src === 'key') { const v = g.aim.v; g.aim = null; g.shoot(v.x, v.y); }
      else g.aim = { src: 'key', v: keyVec() };
      return;
    }
    g.aim = { src: 'key', v: keyVec() };
  });
  cv.addEventListener('blur', () => { if (g.aim?.src === 'key') g.aim = null; });
}
