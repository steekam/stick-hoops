import { sfx } from '../audio/sfx';

/** One row of the scoring table: what you did, what it is worth. */
const SCORING: [string, string][] = [
  ['A make', '2'],
  ['Distance', 'up to +2'],
  ['Swish, nothing but net', '+1'],
  ['Bank shot, off the board', '+1'],
  ['Off the wall first', '+2'],
  ['Moving hoop', '+1'],
];

const STREAK: [string, string][] = [
  ['3 in a row', '×2'],
  ['6 in a row', '×3'],
  ['10 in a row', '×4'],
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function table(rows: [string, string][]): HTMLElement {
  const dl = el('dl', 'ht-rows');
  for (const [k, v] of rows) {
    const row = el('div', 'ht-row');
    row.append(el('dt', '', k), el('dd', '', v));
    dl.appendChild(row);
  }
  return dl;
}

/**
 * The "How to play" card, drawn into the menu screen. Back (or Escape) calls onBack.
 * Returns a cleanup function that removes the Escape listener.
 */
export function renderHowTo(root: HTMLElement, onBack: () => void): () => void {
  root.replaceChildren();
  const wrap = el('div', 'menu howto');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-labelledby', 'howto-title');

  const top = el('div', 'ht-top');
  const h = el('h2', 'menu-h', 'How to play');
  h.id = 'howto-title';
  const back = el('button', 'chip', 'Back');
  back.id = 'btn-howto-back';
  top.append(h, back);
  wrap.appendChild(top);

  const grid = el('div', 'ht-grid');

  const aim = el('section', 'ht-sec');
  aim.append(
    el('h3', 'menu-label', 'Shoot'),
    el('p', '', 'Press anywhere on the court, pull back away from the hoop, and let go. A longer pull shoots harder. Pull down and back for a higher arc.'),
    el('p', 'ht-mute', 'A tiny pull does nothing, so you can always cancel by letting go close to where you pressed.'),
  );

  const keys = el('section', 'ht-sec');
  const kl = el('dl', 'ht-rows');
  for (const [k, v] of [['← →', 'Angle'], ['↑ ↓', 'Power'], ['Space', 'Aim, then shoot']] as const) {
    const row = el('div', 'ht-row');
    const dt = el('dt');
    dt.appendChild(el('kbd', '', k));
    row.append(dt, el('dd', '', v));
    kl.appendChild(row);
  }
  keys.append(el('h3', 'menu-label', 'Keys'), kl);

  const dots = el('section', 'ht-sec');
  dots.append(
    el('h3', 'menu-label', 'Aim dots'),
    el('p', '', 'The dots show where the ball will start to fly. Practice shows the whole arc; harder modes show only the first few dots, so the rest is up to you.'),
  );

  const score = el('section', 'ht-sec ht-wide');
  const cols = el('div', 'ht-cols');
  const a = el('div');
  a.append(table(SCORING));
  const b = el('div');
  b.append(table(STREAK), el('p', 'ht-mute', 'Streak multiplier. A miss resets it.'));
  cols.append(a, b);
  score.append(el('h3', 'menu-label', 'Scoring'), cols);

  grid.append(aim, keys, dots, score);
  wrap.appendChild(grid);

  const foot = el('div', 'btns');
  const done = el('button', 'btn', 'Got it');
  done.id = 'btn-howto-done';
  foot.appendChild(done);
  wrap.appendChild(foot);

  root.appendChild(wrap);
  root.scrollTop = 0;

  const close = () => { cleanup(); sfx.click(); onBack(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  const cleanup = () => document.removeEventListener('keydown', onKey);
  back.onclick = close;
  done.onclick = close;
  document.addEventListener('keydown', onKey);
  back.focus({ preventScroll: true });
  return cleanup;
}
