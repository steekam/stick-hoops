import './menu.css';
import { sfx } from '../audio/sfx';
import { MODES, ModeEntry } from '../modes/registry';
import { readBests, ModeBests } from '../stats';
import { renderHowTo } from './howto';

export interface MenuApi {
  show(): void;
  hide(): void;
  /** Open the menu straight onto the How to play card. */
  showHowTo(): void;
  readonly open: boolean;
}

export interface MenuHooks {
  onPick(m: ModeEntry): void;
  onTutorial(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** "Best 34 · Streak 7" style line for a mode tile, or '' when nothing is recorded yet. */
export function bestLine(b: ModeBests | undefined): string {
  if (!b) return '';
  const parts: string[] = [];
  if (b.level) parts.push(`Level ${b.level}`);
  if (b.score) parts.push(`Best ${b.score}`);
  if (b.streak) parts.push(b.score || b.level ? `Streak ${b.streak}` : `Best streak ${b.streak}`);
  return parts.join(' · ');
}

/** A shooting stick figure in the title, drawn with the ink colour. */
const FIGURE = `<svg viewBox="0 0 64 72" aria-hidden="true" focusable="false">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square">
    <circle cx="26" cy="20" r="7"/>
    <path d="M26 27 L24 50 M24 50 L16 70 M24 50 L32 70 M25 33 L38 18 M25 33 L36 24"/>
    <circle cx="46" cy="9" r="6"/>
  </g>
</svg>`;

export function createMenu(hooks: MenuHooks): MenuApi {
  const root = document.getElementById('menu')!;
  let open = false;
  let stopHowTo: (() => void) | null = null;

  function tile(m: ModeEntry, bests: Record<string, ModeBests>): HTMLButtonElement {
    const b = el('button', 'mode');
    b.id = `mode-${m.id}`;
    b.type = 'button';
    const head = el('span', 'mode-head');
    head.appendChild(el('span', 'mode-name', m.name));
    const best = bestLine(bests[m.id]);
    if (best) head.appendChild(el('span', 'mode-best', best));
    b.append(head, el('span', 'mode-blurb', m.blurb));
    b.onclick = () => { sfx.click(); hooks.onPick(m); };
    return b;
  }

  function group(title: string, list: ModeEntry[], bests: Record<string, ModeBests>, id: string): HTMLElement | null {
    if (!list.length) return null;
    const sec = el('section', 'menu-group');
    const h = el('h3', 'menu-label', title);
    h.id = id;
    sec.setAttribute('aria-labelledby', id);
    const grid = el('div', 'mode-grid');
    for (const m of list) grid.appendChild(tile(m, bests));
    sec.append(h, grid);
    return sec;
  }

  function renderMain(focus = true): void {
    stopHowTo?.();
    stopHowTo = null;
    root.replaceChildren();
    let bests: Record<string, ModeBests> = {};
    try { bests = readBests() ?? {}; } catch { /* records unreadable: show the menu anyway */ }

    const wrap = el('div', 'menu');
    const title = el('div', 'menu-title');
    const fig = el('span', 'menu-fig');
    fig.innerHTML = FIGURE;
    const words = el('div');
    words.append(el('h2', 'menu-h', 'Stick Hoops'), el('p', 'menu-tag', 'Press, pull back, let go.'));
    title.append(fig, words);
    wrap.appendChild(title);

    const solo = group('Play solo', MODES.filter((m) => m.group === 'solo'), bests, 'grp-solo');
    const duo = group('With a friend · one device', MODES.filter((m) => m.group === 'duo'), bests, 'grp-duo');
    if (solo) wrap.appendChild(solo);
    if (duo) wrap.appendChild(duo);

    const foot = el('div', 'menu-foot');
    const how = el('button', 'btn secondary', 'How to play');
    how.id = 'btn-howto';
    how.type = 'button';
    how.onclick = () => { sfx.click(); renderHow(); };
    const tut = el('button', 'btn secondary', 'Tutorial');
    tut.id = 'btn-tutorial';
    tut.type = 'button';
    tut.onclick = () => { sfx.click(); hooks.onTutorial(); };
    foot.append(how, tut);
    wrap.appendChild(foot);

    root.appendChild(wrap);
    root.scrollTop = 0;
    if (focus) (wrap.querySelector('.mode') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  function renderHow(): void {
    stopHowTo = renderHowTo(root, () => {
      stopHowTo = null;
      renderMain(false);
      document.getElementById('btn-howto')?.focus({ preventScroll: true });
    });
  }

  // Arrow keys move between mode tiles, like a list.
  root.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const items = [...root.querySelectorAll<HTMLElement>('.mode, .menu-foot .btn')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    e.preventDefault();
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    items[(i + d + items.length) % items.length].focus();
  });

  return {
    show() { renderMain(); root.hidden = false; open = true; },
    hide() { stopHowTo?.(); stopHowTo = null; root.hidden = true; open = false; },
    showHowTo() { root.hidden = false; open = true; renderHow(); },
    get open() { return open; },
  };
}
