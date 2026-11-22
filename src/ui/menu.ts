import { sfx } from '../audio/sfx';
import { MODES, ModeEntry } from '../modes/registry';

// PLACEHOLDER menu: a plain list of modes. Track A replaces this with the real menu
// (solo / with a friend groups, how-to card, tutorial entry).

export interface MenuApi {
  show(): void;
  hide(): void;
}

export function createMenu(onPick: (m: ModeEntry) => void): MenuApi {
  const root = document.getElementById('menu')!;
  function render(): void {
    root.replaceChildren();
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h2');
    h.textContent = 'Pick a mode';
    card.appendChild(h);
    const btns = document.createElement('div');
    btns.className = 'btns';
    for (const m of MODES) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.id = `mode-${m.id}`;
      b.textContent = m.name;
      b.onclick = () => { sfx.click(); onPick(m); };
      btns.appendChild(b);
    }
    card.appendChild(btns);
    root.appendChild(card);
  }
  return {
    show() { render(); root.hidden = false; },
    hide() { root.hidden = true; },
  };
}
