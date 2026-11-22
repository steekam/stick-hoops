import { court, expect, open, test, waitForHooks } from './fixtures';

test('First run: a new player lands in the tutorial and can finish all three steps', async ({ browser }) => {
  await open(browser, { tutorialDone: false });
  const c = court(browser);
  const strip = browser.locator('#tutorial');
  await expect(strip).toBeVisible();
  await expect(strip).toContainText(/step 1 of 3/i);
  await c.miss();
  await expect(strip).toContainText(/step 2 of 3/i);
  await c.make();
  await expect(strip).toContainText(/step 3 of 3/i);
  expect((await c.state()).world.wall).not.toBeNull();
  expect((await c.make()).made).toBe(true);
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toContain('ready');
  await c.press('Pick a mode');
  await expect(browser.locator('#menu')).toBeVisible();
  await browser.reload();
  await waitForHooks(browser);
  await expect(browser.locator('#menu')).toBeVisible();
});

test('First run: step 3 lets you through after four misses', async ({ browser }) => {
  await open(browser, { tutorialDone: false });
  const c = court(browser);
  await c.miss();
  await c.miss();
  for (let i = 0; i < 4; i++) await c.miss();
  await expect(c.overlay).toBeVisible();
});

test('First run: skip goes to the menu and is remembered', async ({ browser }) => {
  await open(browser, { tutorialDone: false });
  await browser.locator('#btn-skip-tutorial').click();
  await expect(browser.locator('#menu')).toBeVisible();
  await expect(browser.locator('#tutorial')).toBeHidden();
  await browser.reload();
  await waitForHooks(browser);
  await expect(browser.locator('#menu')).toBeVisible();
});

test('First run: the Tutorial button replays it', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-tutorial').click();
  await expect(browser.locator('#tutorial')).toContainText(/step 1 of 3/i);
});

test('Menu: lists all six modes in two groups and each one starts', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await expect(browser.locator('#grp-solo')).toBeVisible();
  await expect(browser.locator('#grp-duo')).toBeVisible();
  for (const id of ['practice', 'levels', 'time', 'streak', 'horse', 'sabotage']) {
    await c.pick(id);
    await expect(browser.locator('#menu')).toBeHidden();
    expect((await c.state()).mode).toBe(id);
    await c.menu();
    await expect(browser.locator('#menu')).toBeVisible();
    await expect(browser.locator('#hud')).toBeHidden();
  }
});

test('Menu: How to play opens and closes, with the scoring numbers', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-howto').click();
  await expect(browser.locator('#menu')).toContainText(/swish/i);
  await expect(browser.locator('#menu')).toContainText('×2');
  await browser.keyboard.press('Escape');
  await expect(browser.locator('#mode-practice')).toBeVisible();
});

test('Menu: leaving a game mid-shot does not leak into the next mode', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('streak');
  await c.make();
  await c.shoot(500, -600);
  await c.menu();
  await c.pick('practice');
  await c.settle();
  await expect(browser.locator('#hud')).toContainText(/practice/i);
  await expect(c.overlay).toBeHidden();
  expect((await c.state()).world.wind).toBe(0);
});

test('Menu: sound setting persists', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-sound').click();
  await expect(browser.locator('#btn-sound')).toHaveText(/sound off/i);
  await browser.reload();
  await waitForHooks(browser);
  await expect(browser.locator('#btn-sound')).toHaveText(/sound off/i);
});

test('Real input: a pointer drag shoots the ball', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  const box = (await browser.locator('#court').boundingBox())!;
  const x = box.x + box.width * 0.6, y = box.y + box.height * 0.5;
  await browser.mouse.move(x, y);
  await browser.mouse.down();
  for (let i = 1; i <= 8; i++) await browser.mouse.move(x - (110 * i) / 8, y + (90 * i) / 8); // a real drag
  await browser.mouse.up();
  expect((await c.state()).ball).toBe(true);
  await c.settle();
  await expect(browser.locator('#hud')).toContainText('/1 MADE');
});

test('Real input: a tiny drag is ignored', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  const box = (await browser.locator('#court').boundingBox())!;
  await browser.mouse.move(box.x + 500, box.y + 200);
  await browser.mouse.down();
  await browser.mouse.move(box.x + 495, box.y + 203);
  await browser.mouse.up();
  expect((await c.state()).ball).toBe(false);
});

test('Real input: keyboard arrows aim, space shoots', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  await browser.locator('#court').focus();
  await browser.keyboard.press('ArrowUp');
  await browser.keyboard.press(' ');
  expect((await c.state()).ball).toBe(true);
});

// e2e has no device emulation (isMobile, touch, device scale); this checks a phone-sized viewport.
test('Layout: menu, game and overlays fit a phone without sideways scrolling', async ({ browser }) => {
  await browser.setViewport({ width: 412, height: 839 });
  await open(browser);
  const c = court(browser);
  const noSideScroll = () => browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noSideScroll()).toBe(true);
  await c.pick('streak');
  expect(await noSideScroll()).toBe(true);
  await c.miss();
  await expect(c.overlay).toBeVisible();
  const btn = browser.locator('#ov-btns button').first();
  const b = (await btn.boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(839);
  await btn.click();
  expect(await noSideScroll()).toBe(true);
});

test('dark theme paints a dark court', async ({ browser }) => {
  await browser.emulateMedia({ colorScheme: 'dark' });
  await open(browser);
  const bg = await browser.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 14, 13)');
});
