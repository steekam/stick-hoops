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
import { sfx } from './audio/sfx';

document.querySelector('.brand-mark')!.innerHTML = MARK;
document.querySelectorAll<HTMLElement>('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon!)));

const canvas = document.getElementById('court') as HTMLCanvasElement;
const shell = createShell();
const game = new Game(canvas, shell);
attachInput(game);

const levelBar = document.getElementById('levels')!;

// Fit the court to the window: everything else on the page keeps its height, the court gets the
// rest, so on a phone held sideways the floor is never below the fold.
const app = document.querySelector('.app') as HTMLElement;
const courtBox = document.querySelector('.court') as HTMLElement;
let courtMax = 0;
function fitCourt(): void {
  const chrome = app.getBoundingClientRect().height - courtBox.getBoundingClientRect().height;
  // 4px spare so rounding never adds a scrollbar, and small changes are ignored so it can't oscillate.
  const w = Math.floor(Math.max(280, (window.innerHeight - chrome - 4) * (16 / 9)));
  if (Math.abs(w - courtMax) < 3) return;
  courtMax = w;
  document.documentElement.style.setProperty('--court-max', `${w}px`);
}
// Applied on the next frame: changing layout inside a ResizeObserver callback makes the browser
// report a "ResizeObserver loop" error.
let fitQueued = false;
const queueFit = () => { if (!fitQueued) { fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitCourt(); }); } };
new ResizeObserver(queueFit).observe(app);
addEventListener('resize', queueFit);
fitCourt();

const menuBtn = document.getElementById('btn-menu') as HTMLButtonElement;
const pauseBtn = document.getElementById('btn-pause') as HTMLButtonElement;
/** What is being played, so Pause → Restart can start it fresh. Null in the tutorial. */
let current: ModeEntry | null = null;

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
  paused = false;
  current = entry;
  menu.hide();
  menuBtn.hidden = false;
  pauseBtn.hidden = false;
  levelBar.hidden = entry.id !== 'levels';
  game.setMode(entry.id === 'levels' ? levels(unlockedLevel(), renderLevelBar) : entry.make());
  canvas.focus();
}

/** Leave whatever is running (a mode or the tutorial) and show the menu. */
function toMenu(howTo = false): void {
  paused = false;
  current = null;
  pauseBtn.hidden = true;
  game.inputEnabled = true;
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
  paused = false;
  current = null;
  pauseBtn.hidden = true;
  menu.hide();
  menuBtn.hidden = false;
  levelBar.hidden = true;
  game.setMode(tutorial({ onExit: () => toMenu(), onHowTo: () => toMenu(true) }));
  canvas.focus({ preventScroll: true });
}

const menu = createMenu({ onPick: play, onTutorial: startTutorial });
menuBtn.onclick = () => toMenu();
shell.onMenu = () => toMenu();

// ---------- pause ----------
// The clock and physics stop; the court still draws. Esc or P toggles, and leaving the tab pauses.
let paused = false;

function pause(): void {
  if (paused || !current || menu.open || game.ui.overlayOpen() || look.isOpen || feedback.isOpen) return;
  paused = true;
  game.inputEnabled = false;
  game.aim = null;
  game.renderer.clearPops();
  sfx.pause(true);
  game.showOverlay('Paused', `${current.name}. The clock is stopped.`, [
    { label: 'Resume', action: resume },
    { label: 'Restart', secondary: true, action: () => { resume(); play(current!); } },
    { label: 'Menu', secondary: true, action: () => toMenu() },
  ]);
}

function resume(): void {
  if (!paused) return;
  paused = false;
  game.ui.hideOverlay();
  game.inputEnabled = true;
  sfx.pause(false);
  last = performance.now();
  canvas.focus({ preventScroll: true });
}

pauseBtn.onclick = () => (paused ? resume() : pause());
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, #feedback, #look, #about')) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (paused) { e.preventDefault(); resume(); } else if (current && !game.ui.overlayOpen()) { e.preventDefault(); pause(); }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

if (tutorialDone()) menu.show();
else startTutorial();

// Look picker: previews of every backdrop. Shooting pauses while it's open.
const look = createLook(game.renderer, (open) => { game.inputEnabled = !open; if (!open) canvas.focus(); });
(document.getElementById('btn-look') as HTMLButtonElement).onclick = () => { if (paused) resume(); if (look.isOpen) look.close(); else look.open(); };

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
(document.getElementById('btn-feedback') as HTMLButtonElement).onclick = () => { if (paused) resume(); if (feedback.isOpen) feedback.close(); else feedback.open(); };
(window as unknown as { openFeedback: typeof feedback.open }).openFeedback = feedback.open;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  // Behind the menu nothing is visible, so skip the work entirely.
  if (menu.open) { requestAnimationFrame(frame); return; }
  if (!paused) game.update(dt);
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

// Offline play: a tiny service worker caches the game after the first visit. Only on the real
// site (not the single-file preview, not under test), and only where browsers allow it.
const testing = new URLSearchParams(location.search).has('e2e');
if (import.meta.env.PROD && import.meta.env.MODE !== 'preview' && !testing && 'serviceWorker' in navigator && isSecureContext) {
  addEventListener('load', () => navigator.serviceWorker.register(`./sw.js?v=${__APP_VERSION__}`).catch(() => {}));
}

// About: a native modal dialog opened from the footer (or the menu's credit line on short screens).
const about = document.getElementById('about') as HTMLDialogElement;
document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('[data-open-about]')) return;
  pause();
  if (!about.open) about.showModal();
});
document.getElementById('about-close')!.onclick = () => about.close();
about.addEventListener('click', (e) => { if (e.target === about) about.close(); }); // the backdrop
about.addEventListener('close', () => { if (!menu.open && !paused) canvas.focus({ preventScroll: true }); });
