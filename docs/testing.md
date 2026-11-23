# Testing

```
npm run typecheck   # the game, tests and the trailer
npm test            # unit tests (Vitest)
npm run test:e2e    # end-to-end tests on the production build (e2e by TesterArmy)
```

First e2e run on a new machine: `npx @e2e-dev/web install chromium`.

## Unit tests

Physics determinism and the golden shot, scoring, the HORSE and Sabotage rules, report
validation, and the feedback Worker against a stubbed GitHub.

## End-to-end tests

The tests load the game with `?e2e`, which installs `window.__test` (`src/game/testing.ts`).
Instead of guessing drag gestures, a test asks the simulation for a launch that scores from where
the shooter stands, then fires it through the real `Game.shoot`. The live loop and
`simulateShot` share the same stepping code, so a planned make that misses live is a real bug.
Every test also fails on any uncaught page error.

What they cover:

- First run: the tutorial plays all three steps, can be skipped, and is remembered.
- Menu: all six modes start and return cleanly; How to play; the sound setting persists.
- Real input: a pointer drag shoots, a tiny drag is ignored, arrows and Space work.
- Every mode played through: all ten levels cleared, unlocks persist, the 60 Seconds clock and
  multiplier, Streak's wind and moving hoop, full HORSE and Sabotage games including sudden death.
- Determinism: 500 shots across walls, wind, tight rims and moving hoops give identical results in
  the browser and in Node.
- Pause (Esc, the button, leaving the tab) freezes the clock; end-of-round cards have Share and
  Menu; the new-best stamp shows only when a best is beaten.
- Layout: the whole court fits on phones held sideways and on short laptops, upright phones keep
  the header on one line, and nothing scrolls sideways. Dark theme.
- Release basics: meta tags, manifest, icons, the social card and the service worker load.
- Feedback form: open and close, draft kept across report types, the GitHub fallback link.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests, as two parallel jobs:

- **check**: typecheck and unit tests, about 20 seconds.
- **e2e**: the browser suite on four workers, with the browser cached between runs.

Doc-only and trailer-only changes skip CI, and a new push to a branch cancels its older run.
On failure the e2e traces are uploaded as an artifact.
