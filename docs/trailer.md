# Trailer

The release trailer (40 seconds, 1080p, 60 fps) isn't screen-recorded. `promo/trailer.ts` drives
the real game engine one frame at a time and draws the effects over it.

- **Shots land on the beat.** Each shot is planned with the game's own simulation, and the launch
  time is solved so the ball drops through the net exactly on a beat, slow motion included.
- **The camera eases.** Each scene says where the camera should be; the camera follows smoothly,
  and camera shake is smooth noise rather than a random jump every frame.
- **Effects:** a pencil that draws the opening court, stamped titles with motion ghosts, comic
  bursts with speed lines and ink splats, scribble wipes and ink swipes between scenes, a comet
  trail on the ball, and paper grain over everything.
- **Soundtrack.** It's synthesized offline in Web Audio:
  - The drums are an 808-style kit.
  - An FM electric piano plays Em9, Cmaj9, G6/9 and D/F♯, over a sliding 808 bass.
  - A whistled hook carries the melody, doubled on mallets.
  - Crowd beds and a roar, sneaker squeaks and vinyl crackle fill out the atmosphere.
  - The music runs through a mix bus with reverb, ducking under the kick, glue compression and a limiter.
  - The game's own sounds (dribbles, rim, swish, buzzer) are recorded as frames are drawn and replayed into the mix.
  - The final file is normalized to −14 LUFS.

Everything is seeded, so a render is repeatable.

## Rendering

Needs ffmpeg and Playwright's Chromium.

```
npx vite --config promo/vite.config.ts &        # trailer page on :5174, no hot reload
node promo/render.mjs                            # → promo/out/stick-hoops-trailer.mp4 (about 4 minutes)
node promo/render.mjs --audio-only               # remake just the soundtrack onto the last video
node promo/render.mjs --stills 640,1300          # a few PNG frames, to check a change
node promo/render.mjs --site example.com         # a different address on the end card
```

The page also takes `?fps=30` for a faster draft render.

The social card `public/og.png` is a frame of the trailer:
`node promo/render.mjs --stills 640 --out promo/out && python3 promo/og.py promo/out/frame-0640.png`.
