import { sfx } from '../audio/sfx';
import { icon } from './icons';
import type { GameUi } from '../game/game';
import type { Hud, OverlayButton } from '../game/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** The DOM around the canvas: scoreboard, end-of-round overlay, sound toggle. */
export function createShell(): GameUi {
  const overlay = $('overlay');

  const sound = $<HTMLButtonElement>('btn-sound');
  const label = () => {
    sound.innerHTML = `${icon(sfx.on ? 'sound' : 'mute')}<span>${sfx.on ? 'Sound on' : 'Sound off'}</span>`;
    sound.setAttribute('aria-pressed', String(sfx.on));
  };
  sound.onclick = () => { sfx.toggle(); label(); };
  label();
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => sfx.resume(), { capture: true });

  return {
    showOverlay(title: string, body: string, buttons: OverlayButton[]) {
      $('ov-title').textContent = title;
      $('ov-body').textContent = body;
      const box = $('ov-btns');
      box.replaceChildren();
      for (const b of buttons) {
        const el = document.createElement('button');
        el.className = b.secondary ? 'btn secondary' : 'btn';
        el.textContent = b.label;
        el.onclick = () => { overlay.hidden = true; sfx.click(); b.action(); };
        box.appendChild(el);
      }
      overlay.hidden = false;
      (box.firstElementChild as HTMLElement | null)?.focus();
    },
    hideOverlay() { overlay.hidden = true; },
    overlayOpen: () => !overlay.hidden,
    setHud(h: Hud) {
      $('hud').hidden = false;
      $('hud-l').textContent = h.left;
      $('hud-m').textContent = h.mid;
      const r = $('hud-r');
      r.textContent = h.right;
      if (h.rightNote) { const s = document.createElement('small'); s.textContent = h.rightNote; r.appendChild(s); }
    },
  };
}
