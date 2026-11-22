import './styles.css';
import { Game } from './game/game';
import { attachInput } from './game/input';
import { LEVELS, levels, LevelsMode, unlockedLevel } from './modes/solo/levels';
import type { ModeEntry } from './modes/registry';
import { createMenu } from './ui/menu';
import { createShell } from './ui/shell';
import { MARK } from './ui/brand';
import { icon } from './ui/icons';
import { createLook } from './ui/look';
import { createFeedback } from './ui/feedback';
import { settings } from './settings';
import { tutorial, tutorialDone } from './ui/tutorial';

document.querySelector('.brand-mark')!.innerHTML = MARK;
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon!)));

const canvas = document.getElementById('court') as HTMLCanvasElement;
const game = new Game(canvas, createShell());
attachInput(game);

const levelBar = document.getElementById('levels')!;

const menuBtn = document.getElementById('btn-menu') as HTMLButtonElement;

/** Level picker shown above the court in Levels mode. */
function renderLevelBar(current: number): void {
  levelBar.replaceChildren();
  const label = document.createElement('span');
  label.textContent = 'Level';
  levelBar.appendChild(label);
  const unlocked = unlockedLevel();
  LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    b.id = `lv-${i}`;
    b.textContent = String(i + 1);
    b.title = L.name;
    b.disabled = i > unlocked;
    b.setAttribute('aria-pressed', String(i === current));
    b.onclick = () => (game.mode as LevelsMode).load(game, i);
    levelBar.appendChild(b);
  });
}

function play(entry: ModeEntry): void {
  menu.hide();
  menuBtn.hidden = false;
  levelBar.hidden = entry.id !== 'levels';
  game.setMode(entry.id === 'levels' ? levels(unlockedLevel(), renderLevelBar) : entry.make());
  canvas.focus();
}

/** Leave whatever is running (a mode or the tutorial) and show the menu. */
function toMenu(howTo = false): void {
  game.mode?.stop?.(game);
  game.ui.hideOverlay();
  game.showHint = false;
  levelBar.hidden = true;
  menuBtn.hidden = true;
  document.getElementById('hud')!.hidden = true;
  if (howTo) menu.showHowTo();
  else menu.show();
}

function startTutorial(): void {
  menu.hide();
  menuBtn.hidden = false;
  levelBar.hidden = true;
  game.setMode(tutorial({ onExit: () => toMenu(), onHowTo: () => toMenu(true) }));
  canvas.focus({ preventScroll: true });
}

const menu = createMenu({ onPick: play, onTutorial: startTutorial });
menuBtn.onclick = () => toMenu();

if (tutorialDone()) menu.show();
else startTutorial();

// Look picker: previews of every backdrop. Shooting pauses while it's open.
const look = createLook(game.renderer, (open) => { game.inputEnabled = !open; if (!open) canvas.focus(); });
(document.getElementById('btn-look') as HTMLButtonElement).onclick = () => (look.isOpen ? look.close() : look.open());

// Feedback: bug reports, level or mode ideas, general feedback. Filed as GitHub issues.
const feedback = createFeedback(
  () => {
    const hud = game.mode && !menu.open ? game.mode.hud(game) : null;
    return {
      version: __APP_VERSION__,
      mode: menu.open ? null : game.mode?.id ?? null,
      hud: hud ? [hud.left, hud.mid, hud.right].filter(Boolean).join(' | ') : '',
      backdrop: settings().backdrop,
      scoreboard: settings().scoreboard,
      viewport: `${innerWidth}x${innerHeight}`,
      userAgent: navigator.userAgent,
    };
  },
  (open) => { game.inputEnabled = !open; if (!open && !menu.open) canvas.focus(); },
);
(document.getElementById('btn-feedback') as HTMLButtonElement).onclick = () => (feedback.isOpen ? feedback.close() : feedback.open());
(window as unknown as { openFeedback: typeof feedback.open }).openFeedback = feedback.open;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  // Behind the menu nothing is visible, so skip the work entirely.
  if (menu.open) { requestAnimationFrame(frame); return; }
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy in the console while playtesting.
(window as unknown as { game: Game }).game = game;
// End-to-end test hooks: only with ?e2e in the URL or in dev. Harmless to players either way,
// since scores will be verified by the server.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('e2e')) {
  // Loaded on demand so players never download the test code.
  import('./game/testing').then((m) => m.installTestHooks(game));
}
