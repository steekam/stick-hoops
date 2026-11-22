import { court, expect, open, test } from './fixtures';

test.describe('First run and tutorial', () => {
  test('a new player lands in the tutorial and can finish all three steps', async ({ page }) => {
    await open(page, { tutorialDone: false });
    const c = court(page);
    const strip = page.locator('#tutorial');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('Step 1 of 3');
    await c.miss();
    await expect(strip).toContainText('Step 2 of 3');
    await c.make();
    await expect(strip).toContainText('Step 3 of 3');
    expect((await c.state()).world.wall).not.toBeNull();
    expect((await c.make()).made).toBe(true); // over the wall
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toContain('ready');
    await c.press('Pick a mode');
    await expect(page.locator('#menu')).toBeVisible();
    await page.reload();
    await expect(page.locator('#menu')).toBeVisible(); // not the tutorial again
  });

  test('step 3 lets you through after four misses', async ({ page }) => {
    await open(page, { tutorialDone: false });
    const c = court(page);
    await c.miss();
    await c.miss();
    for (let i = 0; i < 4; i++) await c.miss();
    await expect(c.overlay).toBeVisible();
  });

  test('skip goes to the menu and is remembered', async ({ page }) => {
    await open(page, { tutorialDone: false });
    await page.locator('#btn-skip-tutorial').click();
    await expect(page.locator('#menu')).toBeVisible();
    await expect(page.locator('#tutorial')).toBeHidden();
    await page.reload();
    await expect(page.locator('#menu')).toBeVisible();
  });

  test('the Tutorial button replays it', async ({ page }) => {
    await open(page);
    await page.locator('#btn-tutorial').click();
    await expect(page.locator('#tutorial')).toContainText('Step 1 of 3');
  });
});

test.describe('Menu', () => {
  test('lists all six modes in two groups and each one starts', async ({ page }) => {
    await open(page);
    const c = court(page);
    const ids = ['practice', 'levels', 'time', 'streak', 'horse', 'sabotage'];
    await expect(page.locator('#grp-solo')).toBeVisible();
    await expect(page.locator('#grp-duo')).toBeVisible();
    for (const id of ids) {
      await c.pick(id);
      await expect(page.locator('#menu')).toBeHidden();
      expect((await c.state()).mode).toBe(id);
      await c.menu();
      await expect(page.locator('#menu')).toBeVisible();
      await expect(page.locator('#hud')).toBeHidden();
    }
  });

  test('How to play opens and closes, with the scoring numbers', async ({ page }) => {
    await open(page);
    await page.locator('#btn-howto').click();
    const card = page.locator('#menu');
    await expect(card).toContainText('Swish');
    await expect(card).toContainText('×2');
    await page.keyboard.press('Escape');
    await expect(page.locator('#mode-practice')).toBeVisible();
  });

  test('leaving a game mid-shot does not leak into the next mode', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('streak');
    await c.make();
    await page.evaluate(() => (window as unknown as { __test: { shoot(a: number, b: number): void } }).__test.shoot(500, -600));
    await c.menu();
    await c.pick('practice');
    await c.settle();
    await expect(page.locator('#hud')).toContainText(/practice/i);
    await expect(c.overlay).toBeHidden();
    expect((await c.state()).world.wind).toBe(0);
  });

  test('sound setting persists', async ({ page }) => {
    await open(page);
    await page.locator('#btn-sound').click();
    await expect(page.locator('#btn-sound')).toHaveText('Sound off');
    await page.reload();
    await expect(page.locator('#btn-sound')).toHaveText('Sound off');
  });
});

test.describe('Real input', () => {
  test('a pointer drag shoots the ball', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('practice');
    const box = (await page.locator('#court').boundingBox())!;
    const x = box.x + box.width * 0.6, y = box.y + box.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 110, y + 90, { steps: 8 });
    await page.mouse.up();
    expect((await c.state()).ball).toBe(true);
    await c.settle();
    await expect(page.locator('#hud')).toContainText('/1 MADE');
  });

  test('a tiny drag is ignored', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('practice');
    const box = (await page.locator('#court').boundingBox())!;
    await page.mouse.move(box.x + 500, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + 495, box.y + 203);
    await page.mouse.up();
    expect((await c.state()).ball).toBe(false);
  });

  test('keyboard: arrows aim, space shoots', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('practice');
    await page.locator('#court').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press(' ');
    expect((await c.state()).ball).toBe(true);
  });
});

test.describe('Layout @phone', () => {
  test('menu, game and overlays fit a phone without sideways scrolling', async ({ page }) => {
    await open(page);
    const c = court(page);
    const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await noSideScroll()).toBe(true);
    await c.pick('streak');
    expect(await noSideScroll()).toBe(true);
    await c.miss();
    await expect(c.overlay).toBeVisible();
    const btn = page.locator('#ov-btns button').first();
    await expect(btn).toBeInViewport();
    await btn.click();
    expect(await noSideScroll()).toBe(true);
  });
});

test('dark theme paints a dark court', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 14, 13)');
});
