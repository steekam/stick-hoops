# Architecture

Stick Hoops is a static site: TypeScript, Vite and raw Canvas 2D, with no framework and no web
fonts. The gzipped JavaScript is about 38 KB.

## Layout

| Folder | What lives there |
| --- | --- |
| `src/sim` | Physics, scoring, seeded RNG. No DOM and no `Math.sin`, so results are bit-identical in every browser and in Node. |
| `src/render` | Canvas drawing: court, hoop, stick figure (the dribble model is in `figure.ts`), backdrops, the dot-matrix scoreboard. Render-only: it never feeds back into the sim. |
| `src/audio` | Every sound, synthesized with Web Audio. No audio files. |
| `src/game` | The loop (`Game`), input, the `Mode` interface every mode implements, and the e2e test hooks. |
| `src/modes` | Solo modes (`solo/`), same-device duo modes (`duo/`), and the registry the menu reads. |
| `src/ui` | The DOM around the canvas: HUD, end-of-round cards, menu, tutorial, Look picker, feedback form, icons. |
| `src/feedback` | Report validation and the GitHub issue format, shared by the game and the Worker. |
| `worker/feedback` | The Cloudflare Worker that turns reports into GitHub issues. |
| `public` | Icons, manifest, service worker, social card, Pages headers. |
| `promo` | The trailer renderer. |
| `tests` | Unit tests (`*.test.ts`) and end-to-end tests (`e2e/`). |

## The loop

`Game` owns the court, the shooter and the ball. Each frame it advances real time, then runs
fixed physics ticks (240 per second) until it catches up. A mode owns the rules through a small
interface: `start`, `canShoot`, `onLaunch`, `onScore`, `onShotEnd`, `update`, `hud`, `draw` and
`stop`. End-of-round cards come from `g.showOverlay(title, body, buttons, { share, best })`; the
shell adds Share and Menu buttons, and `best` triggers the confetti and stamp.

## Determinism rules for `src/sim`

Shots must replay identically everywhere, because a server will re-run them to verify scores.

1. Only `+ - * /`, `Math.sqrt`, `Math.round`, `Math.floor`, `Math.abs`, `Math.min/max` and the
   helpers in `sim/math.ts`. Never `Math.sin/cos/hypot/pow/random`.
2. Time is whole ticks (`TICKS_PER_SEC = 240`). The hoop's sway is a function of the tick.
3. Launches are quantized to 1/16 px/s (`makeLaunch`). A shot is `{tick, px, vx, vy}` plus the world.
4. Randomness comes from a seeded `Rng` (`sim/rng.ts`).

A golden snapshot test pins a known shot. If it changes, stored replays are invalid.

## Drawing

The physics is a 2D plane. Depth is drawing only: an oblique projection (`src/render/iso.ts`)
puts the floor, rim, backboard and walls in perspective, shaded with sketchy hatching instead of
grey fills. The court, its markings and the backdrop are drawn once into an offscreen canvas and
copied each frame. Colours come from CSS custom properties, so the canvas follows the light and
dark themes.

Brand files are in `public/brand/` (the mark is a ball dropping through the ring). The in-game
mark and icons are in `src/ui/brand.ts` and `src/ui/icons.ts`, drawn in `currentColor`.

## Layout on screen

The court keeps a 16:9 box and sizes itself to the window (`fitCourt` in `main.ts`): everything
else on the page keeps its height and the court gets the rest, so a phone held sideways sees the
whole floor. Under 680 px wide the header buttons go icon-only; on short landscape screens the
help text and wordmark hide.
