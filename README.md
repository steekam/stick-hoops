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
