import type { Browser } from '@e2e-dev/web';
import { court, expect, open, test, waitForHooks } from './fixtures';

const hudScore = (b: Browser) => b.evaluate(() => Number(document.getElementById('hud-r')!.firstChild?.textContent));

test('Practice: makes score points, misses count as tries', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  await expect(browser.locator('#hud')).toContainText(/practice/i);
  expect((await c.make()).made).toBe(true);
  await expect(browser.locator('#hud')).toContainText('1/1 MADE');
  expect(await hudScore(browser)).toBeGreaterThanOrEqual(2);
  await c.miss();
  await expect(browser.locator('#hud')).toContainText('1/2 MADE');
});

test('Practice: shooter moves to a new spot after a make', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  const before = (await c.state()).px;
  await c.make();
  expect((await c.state()).px).not.toBe(before);
});

test('Levels: clearing level 1 unlocks level 2, and it stays unlocked after a reload', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('levels');
  await expect(browser.locator('#hud')).toContainText(/level 1\/10/i);
  await expect(browser.locator('#lv-1')).toBeDisabled();
  await c.make();
  await c.make();
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Level 1 cleared');
  await c.press('Level 2');
  await expect(browser.locator('#hud')).toContainText(/level 2\/10/i);
  await expect(browser.locator('#lv-1')).toBeEnabled();
  await browser.reload();
  await waitForHooks(browser);
  await c.pick('levels');
  await expect(browser.locator('#hud')).toContainText(/level 2\/10/i);
});

test('Levels: running out of balls offers a retry with a full rack', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('levels');
  for (let i = 0; i < 5; i++) await c.miss();
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Out of balls');
  await c.press('Retry');
  await expect(browser.locator('#hud-m')).toHaveText('●●●●●');
});

for (let i = 0; i < 10; i++) {
  test(`Levels: level ${i + 1} can be cleared`, async ({ browser }) => {
    await open(browser, { storage: { unlocked: 9 } });
    const c = court(browser);
    await c.pick('levels');
    await browser.locator(`#lv-${i}`).click();
    await expect(browser.locator('#hud')).toContainText(new RegExp(`level ${i + 1}/10`, 'i'));
    for (let k = 0; k < 3 && !(await c.overlay.isVisible()); k++) {
      expect((await c.make()).made, `planned make ${k + 1} on level ${i + 1}`).toBe(true);
    }
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toBe(i === 9 ? 'All ten cleared' : `Level ${i + 1} cleared`);
  });
}

test('60 Seconds: clock waits for the first shot', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await c.advance(5);
  await expect(browser.locator('#hud-m')).toHaveText('1:00');
  await expect(browser.locator('#hud')).toContainText(/starts on first shot/i);
});

test('60 Seconds: streak multiplier, buzzer, and the best score on the menu', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await c.make();
  await c.make();
  await expect(browser.locator('#hud-m')).toContainText('×2');
  const before = await hudScore(browser);
  await c.make();
  const after = await hudScore(browser);
  expect(after - before).toBeGreaterThanOrEqual(4);
  await c.advance(61);
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe("Time's up");
  expect(await c.overlayBody()).toContain(`${after} points`);
  expect(await c.overlayBody()).toContain('New best');
  await c.menu();
  await expect(browser.locator('#mode-time')).toContainText(new RegExp(`best ${after}`, 'i'));
});

test('60 Seconds: no shooting after the buzzer', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('time');
  await c.make();
  await c.advance(61);
  await c.press('Play again');
  await expect(browser.locator('#hud-m')).toHaveText('1:00');
  expect((await c.state()).canShoot).toBe(true);
});

test('Streak: counts makes, adds wind, ends on a miss and keeps the best', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('streak');
  await c.make();
  await c.make();
  await expect(browser.locator('#hud-r')).toContainText('2');
  expect((await c.state()).world.wind).not.toBe(0);
  await expect(browser.locator('#hud-m')).toContainText('WIND');
  await c.miss();
  await expect(c.overlay).toBeVisible();
  expect(await c.overlayTitle()).toBe('Streak over');
  expect(await c.overlayBody()).toContain('2 in a row');
  await c.menu();
  await expect(browser.locator('#mode-streak')).toContainText('2');
});

test('Streak: the hoop starts moving after six makes', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('streak');
  for (let i = 0; i < 6; i++) expect((await c.make()).made).toBe(true);
  expect((await c.state()).world.hoop.my).toBeGreaterThan(0);
  expect((await c.make()).made).toBe(true);
});
