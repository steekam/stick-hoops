// Render the trailer to an MP4.
//
//   npx vite --config promo/vite.config.ts &   # serves promo/trailer.html on :5174
//   node promo/render.mjs            # → promo/out/stick-hoops-trailer.mp4
//   node promo/render.mjs --stills 0,240,600   # just a few PNG frames, for checking
//
// Options: --site <domain> (the address on the end card), --url <trailer page>.
// Needs Playwright's Chromium and ffmpeg on PATH.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const outDir = opt('out', 'promo/out');
const site = opt('site', 'hoops.steekam.me');
const url = `${opt('url', 'http://localhost:5174/promo/trailer.html')}?site=${encodeURIComponent(site)}`;
const stills = opt('stills', '');
const audioOnly = args.includes('--audio-only'); // re-make the soundtrack, keep video.mp4
mkdirSync(outDir, { recursive: true });

const run = (cmd, a) => new Promise((ok, bad) => {
  const p = spawn(cmd, a, { stdio: ['ignore', 'ignore', 'inherit'] });
  p.on('close', (c) => (c === 0 ? ok() : bad(new Error(`${cmd} exited ${c}`))));
});

const browser = await chromium.launch();
// Scale 2: the game canvas renders at 4K, so camera zooms stay crisp in the 1080p output.
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => { console.error('page error:', e.message); process.exitCode = 1; });
await page.goto(url);
await page.waitForFunction(() => window.trailer);
await page.evaluate(() => window.trailer.setup());
const N = await page.evaluate(() => window.trailer.N);
const FPS = await page.evaluate(() => window.trailer.FPS);
console.log('plans', JSON.stringify(await page.evaluate(() => window.trailer.plans())));

if (stills) {
  const want = new Set(stills.split(',').map(Number));
  const last = Math.max(...want);
  for (let i = 0; i <= last; i++) {
    if (want.has(i)) writeFileSync(`${outDir}/frame-${String(i).padStart(4, '0')}.png`, Buffer.from(await page.evaluate((f) => window.trailer.frameData(f), i), 'base64'));
    else await page.evaluate((f) => window.trailer.frame(f), i);
  }
  await browser.close();
  process.exit();
}

const video = `${outDir}/video.mp4`, wav = `${outDir}/audio.wav`, final = `${outDir}/stick-hoops-trailer.mp4`;
if (audioOnly) {
  // Game sounds are recorded while frames are drawn, so play every frame (without encoding).
  for (let i = 0; i < N; i++) await page.evaluate((f) => window.trailer.frame(f), i);
  writeFileSync(wav, Buffer.from(await page.evaluate(() => window.trailer.audio()), 'base64'));
  await browser.close();
  await mux();
  process.exit();
}
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', video], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((ok) => ff.on('close', ok));
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const png = Buffer.from(await page.evaluate((f) => window.trailer.frameData(f), i), 'base64');
  if (!ff.stdin.write(png)) await new Promise((ok) => ff.stdin.once('drain', ok));
  if (i % 60 === 0) console.log(`frame ${i}/${N} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
ff.stdin.end();
await done;
console.log('events', await page.evaluate(() => window.trailer.events()));
writeFileSync(wav, Buffer.from(await page.evaluate(() => window.trailer.audio()), 'base64'));
await browser.close();
await mux();

/** Join picture and sound, loudness-normalized to -14 LUFS (what video sites play back at). */
async function mux() {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-i', wav, '-af', 'loudnorm=I=-14:TP=-1:LRA=11', '-ar', '48000',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
  console.log('wrote', final);
}
