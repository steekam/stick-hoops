# Playwright vs e2e (TesterArmy) on this suite

On 22 November 2026 I moved the end-to-end suite from Playwright to [e2e](https://github.com/e2e-inc/e2e)
and timed both on the same 39 tests before switching.

## What e2e claims about speed

e2e's speed claim is about AI steps: an `agent.act()` step that passed once is recorded, and replays
"at the speed of a scripted test" with no model calls. It does not claim scripted tests run faster
than Playwright.

This suite has no AI steps. Every step is scripted (locators, clicks, `evaluate`), so no model is
needed. **That means the replay claim is not tested here.** Testing it needs agent steps and a model
key; this environment had neither. What this does test is plain scripted performance, which is what
the suite actually uses.

## Setup

- Same 39 tests, ported one for one: menu and tutorial, every solo and duo mode, all ten levels, real
  pointer and keyboard input, and a 500-shot browser vs Node determinism check.
- Same browser binary for both: Chromium 153 headless shell (`chromium_headless_shell-1243`). e2e
  pins Chromium 159, which could not be downloaded in the sandbox, so its browser path was linked to
  the same 153 binary. I confirmed both runners launched the identical executable.
- Same production build, served by one `vite preview` process, started before timing.
- Wall time of the whole CLI command, including runner startup and TypeScript transforms.
- 5 runs per cell, alternating tools run by run so drift hits both. Linux, 2 CPUs.
- Versions: `@playwright/test` 1.63.0, `e2e` 0.24.0 with `@e2e-dev/web` 0.16.1.

## Results

| Workers | Playwright median (min–max) | e2e median (min–max) | e2e speedup |
| --- | --- | --- | --- |
| 1 | 30.1 s (28.8–32.2) | 28.2 s (26.8–28.9) | 1.07× |
| 2 | 26.6 s (22.4–30.8) | 18.7 s (16.8–19.6) | 1.42× |

All 20 runs passed 39/39.

Where the 2-worker gap comes from (one run each, per-test durations from each runner's report):

| | Playwright | e2e |
| --- | --- | --- |
| Sum of per-test time | 47.6 s | 31.7 s |
| Slowest test (full HORSE game) | 8.6 s | 5.7 s |

The difference is inside the tests, not in scheduling. Each browser call costs e2e less CPU, and on a
2-core machine running two browsers and the server, that is what dominates. With one worker the CPU is
not contended and the tools are within 7% of each other. e2e also had much lower run-to-run spread.

## What the switch cost

- **Phone device emulation.** e2e has no `devices['Pixel 7']` (mobile user agent, touch, device scale).
  The phone layout test now resizes the viewport to 412×839 instead.
- **Page errors.** No `page.on('pageerror')`; an init script records uncaught errors on `window`, and
  every test asserts the list is empty.
- **Parallelism inside a file.** e2e runs files in parallel and a file's tests in order. Playwright's
  `fullyParallel` split by test.
- **Text reads are rendered text.** `toContainText` sees CSS `text-transform`, so a few assertions use
  case-insensitive patterns.
- **Pre-1.0.** The API may change between minor versions; versions are pinned exactly.

## Reproduce

Check out the commit before the switch for the Playwright suite, then on each side, with a preview
server already running on port 4173:

```
WORKERS=2 npx playwright test --project desktop   # Playwright, before the switch
WORKERS=2 npx e2e run                             # e2e, after
```
