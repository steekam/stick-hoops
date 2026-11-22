import './styles.css';
import { Game } from './game/game';
import { attachInput } from './game/input';
import { LEVELS, levels, LevelsMode, unlockedLevel } from './modes/solo/levels';
import type { ModeEntry } from './modes/registry';
import { createMenu } from './ui/menu';
import { createShell } from './ui/shell';
import { installTestHooks } from './game/testing';
import { tutorial, tutorialDone } from './ui/tutorial';

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

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.update(dt);
  game.draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy in the console while playtesting.
(window as unknown as { game: Game }).game = game;
// End-to-end test hooks: only with ?e2e in the URL or in dev. Harmless to players either way,
// since scores will be verified by the server.
if (import.meta.env.DEV || new URLSearchParams(location.search).has('e2e')) installTestHooks(game);
