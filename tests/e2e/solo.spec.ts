import { court, expect, open, test } from './fixtures';

test.describe('Practice', () => {
  test('makes score points, misses count as tries', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('practice');
    await expect(page.locator('#hud')).toContainText(/practice/i);
    expect((await c.make()).made).toBe(true);
    await expect(page.locator('#hud')).toContainText('1/1 MADE');
    const pts = Number((await page.locator('#hud-r').innerText()).match(/\d+/)![0]);
    expect(pts).toBeGreaterThanOrEqual(2);
    await c.miss();
    await expect(page.locator('#hud')).toContainText('1/2 MADE');
  });

  test('shooter moves to a new spot after a make', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('practice');
    const before = (await c.state()).px;
    await c.make();
    expect((await c.state()).px).not.toBe(before);
  });
});

test.describe('Levels', () => {
  test('clearing level 1 unlocks level 2, and it stays unlocked after a reload', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('levels');
    await expect(page.locator('#hud')).toContainText(/level 1\/10/i);
    await expect(page.locator('#lv-1')).toBeDisabled();
    await c.make();
    await c.make();
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toBe('Level 1 cleared');
    await c.press('Level 2');
    await expect(page.locator('#hud')).toContainText(/level 2\/10/i);
    await expect(page.locator('#lv-1')).toBeEnabled();
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __test?: unknown }).__test);
    await c.pick('levels');
    await expect(page.locator('#hud')).toContainText(/level 2\/10/i);
  });

  test('running out of balls offers a retry with a full rack', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('levels');
    for (let i = 0; i < 5; i++) await c.miss();
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toBe('Out of balls');
    await c.press('Retry');
    await expect(page.locator('#hud-m')).toHaveText('●●●●●');
  });

  // Every level's course (walls, wind, gusts, moving hoops) must be beatable, and a shot the
  // simulation says scores must score in the live game too.
  for (let i = 0; i < 10; i++) {
    test(`level ${i + 1} can be cleared`, async ({ page }) => {
      await open(page, { storage: { unlocked: 9 } });
      const c = court(page);
      await c.pick('levels');
      await page.locator(`#lv-${i}`).click();
      await expect(page.locator('#hud')).toContainText(new RegExp(`level ${i + 1}/10`, 'i'));
      for (let k = 0; k < 3 && !(await c.overlay.isVisible()); k++) {
        expect((await c.make()).made, `planned make ${k + 1} on level ${i + 1}`).toBe(true);
      }
      await expect(c.overlay).toBeVisible();
      expect(await c.overlayTitle()).toBe(i === 9 ? 'All ten cleared' : `Level ${i + 1} cleared`);
    });
  }
});

test.describe('60 Seconds', () => {
  test('clock waits for the first shot', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('time');
    await c.advance(5);
    await expect(page.locator('#hud-m')).toHaveText('1:00');
    await expect(page.locator('#hud')).toContainText('starts on first shot');
  });

  test('streak multiplier, buzzer, and the best score on the menu', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('time');
    await c.make();
    await c.make();
    await expect(page.locator('#hud-m')).toContainText('×2');
    const before = Number(await page.locator('#hud-r').evaluate((e) => e.firstChild?.textContent));
    await c.make();
    const after = Number(await page.locator('#hud-r').evaluate((e) => e.firstChild?.textContent));
    expect(after - before).toBeGreaterThanOrEqual(4); // at least a 2-pointer doubled
    await c.advance(61);
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toBe('Time');
    expect(await c.overlayBody()).toContain(`${after} points`);
    expect(await c.overlayBody()).toContain('New best');
    await c.menu();
    await expect(page.locator('#mode-time')).toContainText(`Best ${after}`);
  });

  test('no shooting after the buzzer', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('time');
    await c.make();
    await c.advance(61);
    await c.press('Play again');
    await expect(page.locator('#hud-m')).toHaveText('1:00');
    expect((await c.state()).canShoot).toBe(true);
  });
});

test.describe('Streak', () => {
  test('counts makes, adds wind, ends on a miss and keeps the best', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('streak');
    await c.make();
    await c.make();
    await expect(page.locator('#hud-r')).toContainText('2');
    expect((await c.state()).world.wind).not.toBe(0);
    await expect(page.locator('#hud-m')).toContainText('WIND');
    await c.miss();
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toBe('Streak over');
    expect(await c.overlayBody()).toContain('2 in a row');
    await c.menu();
    await expect(page.locator('#mode-streak')).toContainText('2');
  });

  test('the hoop starts moving after six makes', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('streak');
    for (let i = 0; i < 6; i++) expect((await c.make()).made).toBe(true);
    expect((await c.state()).world.hoop.my).toBeGreaterThan(0);
    expect((await c.make()).made).toBe(true); // still makeable while it moves
  });
});
