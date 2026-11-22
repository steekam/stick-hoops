import { sfx } from '../audio/sfx';
import type { Renderer } from '../render/renderer';
import { BACKDROPS, settings, updateSettings } from '../settings';

// The Look picker: a panel over the court with a live picture of every backdrop, drawn by the
// game's own renderer, so what you pick is exactly what you get. Tap a card to switch.

export interface LookApi {
  open(): void;
  close(): void;
  readonly isOpen: boolean;
}

export function createLook(renderer: Renderer, onToggle: (open: boolean) => void): LookApi {
  const root = document.getElementById('look')!;
  let open = false;

  function render(): void {
    const st = settings();
    root.replaceChildren();
    const panel = document.createElement('div');
    panel.className = 'look';

    const top = document.createElement('div');
    top.className = 'look-top';
    const h = document.createElement('h2');
    h.textContent = 'Look';
    const done = document.createElement('button');
    done.id = 'look-done';
    done.className = 'btn';
    done.textContent = 'Done';
    done.onclick = () => { sfx.click(); api.close(); };
    top.append(h, done);

    const grid = document.createElement('div');
    grid.className = 'look-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', 'Backdrop');
    const width = Math.min(360, Math.max(150, (root.clientWidth - 64) / 2));
    for (const b of BACKDROPS) {
      const card = document.createElement('button');
      card.id = `bd-${b.id}`;
      card.className = 'look-card';
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', String(st.backdrop === b.id));
      card.setAttribute('aria-pressed', String(st.backdrop === b.id));
      const pic = renderer.thumbnail(b.id, width, st.scoreboard);
      pic.className = 'look-pic';
      pic.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'look-name';
      name.textContent = b.name;
      card.append(pic, name);
      card.onclick = () => { sfx.click(); updateSettings({ backdrop: b.id }); render(); };
      grid.appendChild(card);
    }

    const sb = document.createElement('button');
    sb.id = 'bd-scoreboard';
    sb.className = 'look-switch';
    sb.setAttribute('role', 'switch');
    sb.setAttribute('aria-checked', String(st.scoreboard));
    sb.setAttribute('aria-pressed', String(st.scoreboard));
    sb.innerHTML = '<span class="knob" aria-hidden="true"></span>';
    sb.append(document.createTextNode(st.scoreboard ? 'Scoreboard on' : 'Scoreboard off'));
    sb.onclick = () => { sfx.click(); updateSettings({ scoreboard: !settings().scoreboard }); render(); };

    panel.append(top, grid, sb);
    root.appendChild(panel);
    (root.querySelector(`#bd-${st.backdrop}`) as HTMLElement | null)?.focus({ preventScroll: true });
  }

  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });

  const api: LookApi = {
    open() { open = true; root.hidden = false; render(); onToggle(true); },
    close() { open = false; root.hidden = true; onToggle(false); },
    get isOpen() { return open; },
  };
  return api;
}
