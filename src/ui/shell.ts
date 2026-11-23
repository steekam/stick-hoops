import { sfx } from '../audio/sfx';
import { icon } from './icons';
import type { GameUi } from '../game/game';
import type { Hud, OverlayButton, RoundEnd } from '../game/types';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Where shared links point. Set VITE_SITE_URL at build time; otherwise this page. */
export function siteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL;
  if (env) return env;
  return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : '';
}

/** Share a line with the native sheet, or copy it. Resolves to what happened, for the button label. */
export async function shareText(text: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = siteUrl();
  const full = url ? `${text} ${url}` : text;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ text, url: url || undefined }); return 'shared'; } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared'; // they closed the sheet: not an error
    }
  }
  try { await navigator.clipboard.writeText(full); return 'copied'; } catch { return 'failed'; }
}

export interface Shell extends GameUi {
  /** Called by the Menu button on end-of-round cards. */
  onMenu: () => void;
}

/** The DOM around the canvas: scoreboard, end-of-round overlay, sound toggle. */
export function createShell(): Shell {
  const overlay = $('overlay');

  const sound = $<HTMLButtonElement>('btn-sound');
  const label = () => {
    sound.innerHTML = `${icon(sfx.on ? 'sound' : 'mute')}<span class="lbl">${sfx.on ? 'Sound on' : 'Sound off'}</span>`;
    sound.setAttribute('aria-label', sfx.on ? 'Sound on' : 'Sound off');
    sound.setAttribute('aria-pressed', String(sfx.on));
  };
  sound.onclick = () => { sfx.toggle(); label(); };
  label();
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, () => sfx.resume(), { capture: true });

  const shell: Shell = {
    onMenu: () => {},
    showOverlay(title: string, body: string, buttons: OverlayButton[], end?: RoundEnd) {
      $('ov-title').textContent = title;
      $('ov-body').textContent = body;
      const card = overlay.querySelector('.card')!;
      card.classList.toggle('best', !!end?.best);
      card.classList.toggle('end', !!end);
      const box = $('ov-btns');
      box.replaceChildren();
      const add = (label: string, secondary: boolean, id: string, onClick: (el: HTMLButtonElement) => void) => {
        const el = document.createElement('button');
        el.className = secondary ? 'btn secondary' : 'btn';
        el.textContent = label;
        if (id) el.id = id;
        el.onclick = () => onClick(el);
        box.appendChild(el);
      };
      for (const b of buttons) add(b.label, !!b.secondary, '', () => { overlay.hidden = true; sfx.click(); b.action(); });
      if (end?.share) {
        const text = end.share;
        add('Share', true, 'ov-share', async (el) => {
          sfx.click();
          const r = await shareText(text);
          el.textContent = r === 'copied' ? 'Copied' : r === 'shared' ? 'Share' : 'Copy failed';
          if (r === 'failed') $('ov-body').textContent += ` ${text}`;
        });
      }
      if (end) add('Menu', true, 'ov-menu', () => { overlay.hidden = true; sfx.click(); shell.onMenu(); });
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
  return shell;
}
