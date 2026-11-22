import { sfx } from '../audio/sfx';
import type { Game } from '../game/game';
import type { Mode } from '../game/types';
import type { ShotResult } from '../sim/shot';
import { store } from '../storage';

const KEY = 'tutorialDone';
export const tutorialDone = (): boolean => store.get(KEY, false);
export const markTutorialDone = (): void => store.set(KEY, true);

export interface TutorialHooks {
  /** "Pick a mode" on the finish card, or Skip. */
  onExit(): void;
  /** "How to play" on the finish card. */
  onHowTo(): void;
}

interface Step {
  title: string;
  text: string;
  dots: number;
  setup(g: Game): void;
}

const STEPS: Step[] = [
  {
    title: 'Pull back',
    text: 'Press on the court, pull back away from the hoop, and let go. The dots show where the ball goes.',
    dots: 34,
    setup(g) { g.placePlayer(560, true); g.showHint = true; },
  },
  {
    title: 'Power',
    text: 'You are farther out now. A longer pull shoots harder. The dots are shorter, so judge the rest by eye.',
    dots: 12,
    setup(g) { g.placePlayer(250); g.showHint = false; },
  },
  {
    title: 'Arc',
    text: 'A wall is in the way. Pull down and back for a higher arc that drops over it.',
    dots: 22,
    setup(g) { g.world.wall = { x: 600, w: 16, h: 180 }; g.placePlayer(380); g.showHint = false; },
  },
];

const MAX_ARC_TRIES = 4;

/**
 * The guided first-run tutorial: three shots on the real court with a small instruction strip
 * above it. Implemented as a Mode so the Game runs it like any other.
 */
export function tutorial(hooks: TutorialHooks): Mode {
  const bar = document.getElementById('tutorial')!;
  const help = document.getElementById('help');
  let step = 0;
  let tries = 0;
  let note = '';
  let done = false;
  let active = false;

  function renderBar(): void {
    bar.replaceChildren();
    const dots = document.createElement('div');
    dots.className = 'tut-dots';
    dots.setAttribute('aria-hidden', 'true');
    STEPS.forEach((_, i) => { const d = document.createElement('i'); if (done || i <= step) d.className = 'on'; dots.appendChild(d); });
    const label = document.createElement('span');
    label.className = 'tut-step';
    label.textContent = done ? 'Tutorial · done' : `Step ${step + 1} of ${STEPS.length}`;

    const body = document.createElement('div');
    body.className = 'tut-body';
    body.setAttribute('aria-live', 'polite');
    const s = STEPS[step];
    const t = document.createElement('span');
    t.className = 'tut-title';
    t.textContent = done ? "You're ready" : s.title;
    const p = document.createElement('span');
    p.className = 'tut-text';
    p.textContent = done ? 'Pick a mode to play.' : s.text;
    body.append(t, p);
    if (note && !done) {
      const n = document.createElement('span');
      n.className = 'tut-note';
      n.textContent = note;
      body.appendChild(n);
    }

    const skip = document.createElement('button');
    skip.className = 'chip';
    skip.id = 'btn-skip-tutorial';
    skip.type = 'button';
    skip.textContent = done ? 'Close' : 'Skip tutorial';
    skip.onclick = () => { sfx.click(); markTutorialDone(); hooks.onExit(); };

    const meta = document.createElement('div');
    meta.className = 'tut-meta';
    meta.append(label, dots);
    bar.append(meta, body, skip);
  }

  function enter(g: Game, i: number): void {
    step = i;
    tries = 0;
    note = '';
    STEPS[i].setup(g);
    renderBar();
    g.refreshHud(true);
  }

  function finish(g: Game, made: boolean): void {
    done = true;
    markTutorialDone();
    g.showHint = false;
    renderBar();
    g.refreshHud(true);
    bar.hidden = true;
    const lead = made ? 'Over the wall and in.' : 'Walls take practice. Levels has plenty.';
    g.showOverlay("You're ready", `${lead} Scoring is in How to play.`, [
      { label: 'Pick a mode', action: () => hooks.onExit() },
      { label: 'How to play', secondary: true, action: () => hooks.onHowTo() },
    ]);
  }

  return {
    id: 'tutorial',
    name: 'Tutorial',
    start(g) {
      step = 0; tries = 0; note = ''; done = false; active = true;
      bar.hidden = false;
      if (help) help.hidden = true;
      enter(g, 0);
    },
    aimDots: () => (done ? 0 : STEPS[step].dots),
    canShoot: () => !done,
    onLaunch(g) { tries++; if (step === 0) g.showHint = false; },
    onShotEnd(g, r: ShotResult) {
      if (done) return;
      if (step === 0) {
        g.pop(r.made ? 'NICE' : 'GOOD');
        enter(g, 1);
        note = r.made ? 'Nice shot.' : 'That is the motion.';
        renderBar();
        return;
      }
      if (step === 1) {
        g.pop(r.made ? 'NICE' : 'OK');
        enter(g, 2);
        note = r.made ? 'Good power.' : 'Close enough. You will get a feel for it.';
        renderBar();
        return;
      }
      if (r.made) { g.pop('OVER'); finish(g, true); return; }
      if (tries >= MAX_ARC_TRIES) { finish(g, false); return; }
      const left = MAX_ARC_TRIES - tries;
      note = `Higher: pull more down than sideways. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
      renderBar();
    },
    hud: () => ({
      left: done ? 'Tutorial · done' : `Tutorial · ${STEPS[step].title}`,
      mid: '',
      right: done ? '3/3' : `${step + 1}/${STEPS.length}`,
      rightNote: 'STEP',
    }),
    stop(g) {
      if (!active) return;
      active = false;
      markTutorialDone();
      g.showHint = false;
      bar.hidden = true;
      bar.replaceChildren();
      if (help) help.hidden = false;
    },
  };
}
