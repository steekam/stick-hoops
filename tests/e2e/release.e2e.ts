import type { Browser } from '@e2e-dev/web';
import { court, evaluate, expect, open, test } from './fixtures';

// Release checks: pause, end-of-round cards, the new-best celebration, the court fitting on
// phones, and what a shared link or an install needs (meta tags, manifest, icons).

const clock = (b: Browser) => b.locator('#hud-m').textContent();
const hide = (b: Browser, hidden: boolean) =>
  evaluate(b, (h: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

test('Pause: Esc stops the clock, Esc again resumes it', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await expect(browser.locator('#btn-pause')).toBeVisible();
  await c.make();
  await browser.locator('#court').press('Escape');
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Paused');
  const frozen = await clock(browser);
  await new Promise((r) => setTimeout(r, 2200));
  expect(await clock(browser)).toBe(frozen);
  expect((await c.state()).canShoot).toBe(false);
  await browser.locator('#court').press('Escape');
  await expect(c.overlay).toBeHidden();
  await expect.poll(() => clock(browser), { timeout: 4000 }).not.toBe(frozen);
});

test('Pause: leaving the tab pauses; Restart starts the mode fresh', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await c.make();
  await hide(browser, true);
  await hide(browser, false);
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Paused');
  await c.press('Restart');
  await expect(c.overlay).toBeHidden();
  await expect(browser.locator('#hud-m')).toHaveText('1:00');
  expect(Number(await browser.evaluate(() => document.getElementById('hud-r')!.firstChild?.textContent ?? ''))).toBe(0);
});

test('Pause: the header button pauses, and Menu from the pause card leaves the round', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  await browser.locator('#btn-pause').click();
  await expect(c.overlay).toBeVisible();
  await c.press('Menu');
  await expect(browser.locator('#menu')).toBeVisible();
  await expect(browser.locator('#btn-pause')).toBeHidden();
});

test('No pause in the tutorial or on the menu', async ({ browser }) => {
  await open(browser, { tutorialDone: false });
  await expect(browser.locator('#tutorial')).toBeVisible();
  await expect(browser.locator('#btn-pause')).toBeHidden();
  await browser.locator('#court').press('Escape');
  await expect(court(browser).overlay).toBeHidden();
});

test('End of round: a new best gets the stamp, Share and Menu work', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await c.make();
  await c.advance(61);
  await c.settle();
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Time');
  expect(await browser.evaluate(() => document.querySelector('#overlay .card')!.classList.contains('best'))).toBe(true);
  expect(await c.overlayBody()).toMatch(/^\d+ points?\. /);
  const share = browser.locator('#ov-share');
  await share.click();
  // Copied where the clipboard is allowed; otherwise the line is shown so it can be copied by hand.
  await expect(share).toHaveText(/copied|copy failed/i);
  await browser.locator('#ov-menu').click();
  await expect(browser.locator('#menu')).toBeVisible();
});

test('End of round: no stamp when the best was not beaten', async ({ browser }) => {
  await open(browser, { storage: { bests: { time: { score: 999 } } } });
  const c = court(browser);
  await c.pick('time');
  await c.miss();
  await c.advance(61);
  await c.settle();
  await expect(c.overlay).toBeVisible();
  expect(await browser.evaluate(() => document.querySelector('#overlay .card')!.classList.contains('best'))).toBe(false);
  await expect(browser.locator('#ov-menu')).toBeVisible();
});

test('Duo winners get Share and Menu too', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('sabotage');
  let shots = 0;
  for (let guard = 0; guard < 40; guard++) {
    await expect(c.overlay).toBeVisible();
    const title = await c.overlayTitle();
    if (title.includes('wins')) break;
    if (title.includes('power-up')) { await c.press('Save it'); continue; }
    await c.press('Ready');
    shots++;
    // P1 makes everything, P2 misses: P1 wins in regulation.
    if ((await c.state()).tag === 'P1') await c.make(); else await c.miss();
  }
  expect(await c.overlayTitle()).toBe('P1 wins');
  await expect(browser.locator('#ov-share')).toBeVisible();
  await expect(browser.locator('#ov-menu')).toBeVisible();
});

for (const [name, size] of [['phone sideways', { width: 750, height: 342 }], ['small phone sideways', { width: 568, height: 320 }], ['short laptop', { width: 1280, height: 600 }]] as const) {
  test(`Layout: the whole court fits on a ${name}, with the clock showing`, async ({ browser }) => {
    await browser.setViewport(size);
    await open(browser);
    const c = court(browser);
    await c.pick('time');
    await expect.poll(() => browser.evaluate(() => document.querySelector('.court')!.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
    expect(await browser.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(browser.locator('#hud-m')).toBeVisible();
    await expect(browser.locator('#hud-m')).toHaveText('1:00');
  });
}

test('Layout: phone upright keeps the header on one line and shows the clock', async ({ browser }) => {
  await browser.setViewport({ width: 390, height: 664 });
  await open(browser);
  await court(browser).pick('time');
  expect(await browser.evaluate(() => document.querySelector('header')!.getBoundingClientRect().height)).toBeLessThan(60);
  await expect(browser.locator('#hud-m')).toBeVisible();
  await expect(browser.locator('#btn-look')).toHaveAttribute('aria-label', 'Look');
});

test('Sharing and installing: meta tags, manifest and icons are all there', async ({ browser }) => {
  await open(browser);
  const head = await browser.evaluate(() => {
    const m = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? null;
    return {
      desc: m('meta[name=description]'),
      ogImage: m('meta[property="og:image"]'),
      card: m('meta[name="twitter:card"]'),
      theme: m('meta[name=theme-color]'),
      manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? null,
      touch: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href') ?? null,
    };
  });
  expect(head.desc).toBeTruthy();
  expect(head.ogImage).toMatch(/^https:\/\/.+\/og\.png$/);
  expect(head.card).toBe('summary_large_image');
  expect(head.theme).toBeTruthy();
  const files = await evaluate<{ manifest: { name: string; icons: { src: string }[] }; status: Record<string, number> }>(browser, async (paths: string[]) => {
    const manifest = await (await fetch('manifest.webmanifest')).json();
    const all = [...paths, ...manifest.icons.map((i: { src: string }) => i.src), 'og.png', 'sw.js'];
    const status: Record<string, number> = {};
    for (const p of all) status[p] = (await fetch(p)).status;
    return { manifest, status };
  }, [head.manifest, head.touch]);
  expect(files.manifest.name).toBe('Stick Hoops');
  for (const [p, s] of Object.entries(files.status)) expect(s, p).toBe(200);
});

test('Footer credits steekam and links the source; on short landscape screens the menu carries it', async ({ browser }) => {
  await open(browser);
  const links = await browser.evaluate(() => [...document.querySelectorAll('#site-foot a')].map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')]));
  expect(links).toEqual([['steekam', 'https://steekam.me', '_blank'], ['Source on GitHub', 'https://github.com/steekam/stick-hoops', '_blank']]);
  await expect(browser.locator('#app-ver')).toHaveText(/^v\d+\.\d+\.\d+$/);
  await browser.setViewport({ width: 750, height: 342 });
  await expect(browser.locator('#site-foot')).toBeHidden();
  await expect(browser.locator('.menu-credit')).toBeVisible();
});

test('Search: canonical URL, Twitter tags, structured data, robots, sitemap and a 404 page', async ({ browser }) => {
  await open(browser);
  const head = await browser.evaluate(() => {
    const m = (sel: string) => document.querySelector(sel)?.getAttribute('content') ?? null;
    const ld = document.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}';
    return {
      title: document.title,
      canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null,
      creator: m('meta[name="twitter:creator"]'),
      twImage: m('meta[name="twitter:image"]'),
      ld: JSON.parse(ld) as { '@type'?: string; name?: string; url?: string; author?: { url?: string } },
      about: document.querySelector('.about')?.textContent?.length ?? 0,
    };
  });
  expect(head.title).toMatch(/stick-figure basketball/i);
  expect(head.canonical).toMatch(/^https:\/\/[^/]+\/$/);
  expect(head.creator).toBe('@mauwanyee');
  expect(head.twImage).toBe(`${head.canonical}og.png`);
  expect(head.ld['@type']).toBe('VideoGame');
  expect(head.ld.name).toBe('Stick Hoops');
  expect(head.ld.url).toBe(head.canonical ?? undefined);
  expect(head.ld.author?.url).toBe('https://steekam.me');
  expect(head.about).toBeGreaterThan(400);
  const files = await evaluate<Record<string, [number, string]>>(browser, async () => {
    const out: Record<string, [number, string]> = {};
    for (const p of ['robots.txt', 'sitemap.xml', '404.html']) { const r = await fetch(p); out[p] = [r.status, await r.text()]; }
    return out;
  });
  expect(files['robots.txt'][1]).toMatch(/Sitemap: https:\/\/.+\/sitemap\.xml/);
  expect(files['sitemap.xml'][1]).toContain('<loc>');
  expect(files['404.html'][1]).toContain('Back to the court');
});
