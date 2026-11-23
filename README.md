# Stick Hoops

A pencil-sketch basketball game. Press, pull back, let go. Six modes, two of them for two
players on one device. Free, no sign-up, plays offline.

![Stick Hoops](public/og.png)

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
| `promo` | The release trailer, rendered frame by frame with the real engine (see below). |
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
- Release: pause (Esc, the button, leaving the tab) freezes the clock; end-of-round cards have
  Share and Menu; the new-best stamp shows only when a best is beaten; the whole court fits on
  phones held sideways and short laptops; meta tags, manifest, icons and the service worker load.

CI runs both suites on every push.

## Look and brand

Pencil on paper: the court is a flat side-view game drawn with depth around it (a floor seen from slightly above
with a thick front edge, a ring-shaped rim, slab backboard and wall, cast shadows), shaded with
hatching rather than grey fills. The depth is drawing only (`src/render/iso.ts`); the physics is
still the 2D plane at z = 0, so replays are unaffected.

Brand files live in `public/brand/`: `logo.svg` (mark and wordmark; the mark is the ball dropping through the ring), `mark.svg`, `mark-dark.svg`,
and `public/favicon.svg`. The in-game versions and the icon set are in `src/ui/brand.ts` and
`src/ui/icons.ts`, drawn in `currentColor` so they follow the light and dark themes.

## Feedback

Players can report a bug, suggest a level or mode, or send feedback from the game (the Feedback
button in the header, or "Suggest a level or mode" on the menu). Reports become labelled GitHub
issues (`bug`, `idea`, `feedback`, plus `from-game`) through a free Cloudflare Worker in
`worker/feedback/`, so players don't need an account. Bug reports can carry the mode, backdrop,
screen size, browser and recent errors; the player can untick that.

Until the Worker is deployed (see `worker/feedback/README.md`, about 10 minutes, $0), or if it's
down, the form offers a prefilled GitHub issue instead.

## Deploying

The game is a static site: `npm run build` and upload `dist/`. It costs nothing to host.

**Cloudflare Pages** (recommended): connect the repo, build command `npm run build`, output
directory `dist`. `public/_headers` sets caching: hashed files are cached for a year, the page
and service worker are always revalidated, so a new release shows up on the next visit.

Set `VITE_SITE_URL` (in `.env`, or as a Pages environment variable) to the address you deploy
to, with a trailing slash. Share links and the social card (`og.png`) use it. It defaults to
`https://stick-hoops.pages.dev/`.

After the first visit the game works offline (`public/sw.js`). Each release registers the worker
with its version number, which clears the old cache.

## Trailer

`promo/trailer.ts` draws a 40-second trailer with the game engine itself. Shots are planned with
the simulation so each ball drops through the net on a beat; the soundtrack is a beat
synthesized in Web Audio plus the game's own sounds, replayed offline.

```
npx vite --config promo/vite.config.ts &      # trailer page on :5174, no hot reload
node promo/render.mjs                          # → promo/out/stick-hoops-trailer.mp4
node promo/render.mjs --site example.com       # different address on the end card
python3 promo/og.py promo/out/frame-0320.png   # rebuild public/og.png (render --stills 320 first)
```

Needs ffmpeg and Playwright's Chromium.
