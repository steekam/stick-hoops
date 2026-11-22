import './styles.css';
import { Game } from './game/game';
import { attachInput } from './game/input';
import { LEVELS, levels, LevelsMode, unlockedLevel } from './modes/solo/levels';
import type { ModeEntry } from './modes/registry';
import { createMenu } from './ui/menu';
import { createShell } from './ui/shell';

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

const menu = createMenu(play);
menuBtn.onclick = () => {
  game.mode?.stop?.(game);
  game.ui.hideOverlay();
  levelBar.hidden = true;
  menuBtn.hidden = true;
  menu.show();
};

menu.show();

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
