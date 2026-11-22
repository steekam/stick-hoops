# Stick Hoops

A black-and-white stick figure basketball game. Press, pull back, let go.

```
npm install
npm run dev            # play locally
npm test               # simulation tests (determinism, replays)
npm run build          # deployable site in dist/
npm run build:preview  # single-file build for the Claude artifact preview (dist-preview/artifact.html)
```

## Layout

| Folder | What lives there |
| --- | --- |
| `src/sim` | Physics, scoring, seeded RNG. No DOM, no `Math.sin`: results are bit-identical in every browser and on the server, which re-runs shots to verify scores. |
| `src/render` | Canvas drawing: court, hoop, stick figure (dribble model in `figure.ts`). Render-only, never feeds back into the sim. |
| `src/audio` | Synthesized Web Audio effects. No sound files. |
| `src/game` | The game loop (`Game`), input, and the `Mode` interface every mode implements. |
| `src/modes` | Solo modes (`solo/`), same-device duo modes (`duo/`), and the registry the menu reads. |
| `src/ui` | DOM around the canvas: shell (HUD, overlay), menu, tutorial. |
| `src/net` | Transport interface. Phase 1 is local only; phase 2 adds PartyKit rooms behind it. |

## Determinism rules for `src/sim`

1. Only `+ - * /`, `Math.sqrt`, `Math.round`, `Math.floor`, `Math.abs`, `Math.min/max` and the helpers in `sim/math.ts`. Never `Math.sin/cos/hypot/pow/random`.
2. Time is whole ticks (`TICKS_PER_SEC = 240`). The hoop's sway is a function of the tick.
3. Launches are quantized to 1/16 px/s (`makeLaunch`). A shot is `{tick, px, vx, vy}` plus the world.
4. Randomness comes from a seeded `Rng` (`sim/rng.ts`).

The golden snapshot in `tests/` pins a known shot. If it changes, stored replays are invalid.

## Testing

```
npm test           # unit: physics determinism, golden shot, scoring, HORSE/Sabotage rules
npm run test:e2e   # browser: every mode played end to end on the production build (e2e by TesterArmy)
```

The end-to-end tests use [e2e](https://github.com/e2e-inc/e2e) (they moved from Playwright; see
[BENCHMARK.md](BENCHMARK.md) for the timing comparison). First run: `npx @e2e-dev/web install chromium`.
They load the game with `?e2e`, which installs `window.__test` (see `src/game/testing.ts`).
Instead of guessing drag gestures, a test asks the simulation for a launch that scores from where the
shooter stands, then fires it through the real `Game.shoot`. Because the live loop and `simulateShot`
share the same stepping code, a planned make that misses live is a real bug.

What they cover:

- First run: the tutorial plays all three steps, can be skipped, and is remembered.
- Menu: all six modes start and return cleanly; How to play; sound setting persists.
- Real input: a pointer drag shoots, a tiny drag is ignored, arrows and space work.
- Practice, Levels (every one of the ten levels is cleared, unlocks persist, out-of-balls retry),
  60 Seconds (clock waits for the first shot, streak multiplier, buzzer, best on the menu),
  Streak (wind after 2, moving hoop after 6, best kept).
- HORSE: a full game to a winner, the matcher gets the setter's spot and wind, New spot once per turn.
- Sabotage: a full match where a power-up hits only the next opposing shot; ties go to sudden death.
- Determinism: 500 shots across walls, wind, tight rims and moving hoops give identical results in
  the browser and in Node, which is what the server will use to verify scores.
- Layout at phone size (no sideways scrolling, overlay buttons on screen) and the dark theme.

CI runs both suites on every push.

## Look and brand

Pencil on paper: the court is a flat side-view game drawn with depth around it (a floor seen from slightly above
with a thick front edge, a ring-shaped rim, slab backboard and wall, cast shadows), shaded with
hatching rather than grey fills. The depth is drawing only (`src/render/iso.ts`); the physics is
still the 2D plane at z = 0, so replays are unaffected.

Brand files live in `public/brand/`: `logo.svg` (mark and wordmark; the mark is the ball dropping through the ring), `mark.svg`, `mark-dark.svg`,
and `public/favicon.svg`. The in-game versions and the icon set are in `src/ui/brand.ts` and
`src/ui/icons.ts`, drawn in `currentColor` so they follow the light and dark themes.
