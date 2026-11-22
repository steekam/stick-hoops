import { court, expect, open, test } from './fixtures';

test.describe('HORSE', () => {
  test('a full game: P1 sets and makes, P2 misses every match, P1 wins and can rematch', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('horse');
    let letters = 0;
    for (let guard = 0; guard < 30; guard++) {
      await expect(c.overlay).toBeVisible();
      const title = await c.overlayTitle();
      if (title.includes('wins')) break;
      if (title.includes('to match')) {
        expect(title).toContain('P2');
        await c.press('Ready');
        expect((await c.state()).tag).toBe('P2');
        await c.miss();
        letters++;
        if (letters < 5) await expect(page.locator('#hud')).toContainText('HORSE'.slice(0, letters));
      } else {
        await c.press('Shoot from here');
        expect((await c.state()).tag).toBe('P1');
        expect((await c.make()).made).toBe(true);
      }
    }
    expect(await c.overlayTitle()).toBe('P1 wins');
    expect(letters).toBe(5);
    await c.press('Rematch');
    await expect(c.overlay).toBeVisible();
  });

  test('the matcher shoots from the setter\'s spot and wind', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('horse');
    await c.press('Shoot from here');
    const set = await c.state();
    await c.make();
    await expect(c.overlay).toBeVisible();
    await c.press('Ready');
    const match = await c.state();
    expect(match.px).toBe(set.px);
    expect(match.world.wind).toBe(set.world.wind);
    expect(match.variant).not.toBe(set.variant);
  });

  test('a missed set passes control without a letter', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('horse');
    await c.press('Shoot from here');
    await c.miss();
    await expect(c.overlay).toBeVisible();
    expect(await c.overlayTitle()).toContain('P2');
    expect(await c.overlayTitle()).not.toContain('match');
  });

  test('New spot is offered once per turn', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('horse');
    const a = (await c.state()).px;
    await c.press('New spot');
    await expect(c.overlay).toBeVisible();
    expect((await c.state()).px).not.toBe(a);
    await expect(page.locator('#ov-btns button', { hasText: 'New spot' })).toHaveCount(0);
  });
});

test.describe('Sabotage', () => {
  test('a full match with a power-up: it hits only the next opponent shot', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('sabotage');
    let armed = false, checked = false;
    for (let guard = 0; guard < 40; guard++) {
      await expect(c.overlay).toBeVisible();
      const title = await c.overlayTitle();
      if (title.includes('wins')) break;
      if (title.includes('power-up')) {
        await c.press('Tight rim');
        armed = true;
        continue;
      }
      await c.press('Ready');
      const s = await c.state();
      if (s.tag === 'P1') {
        expect(s.world.rimW).toBe(50);
        expect((await c.make()).made).toBe(true);
      } else {
        if (armed && !checked) { expect(s.world.rimW).toBe(34); checked = true; }
        else expect(s.world.rimW).toBe(50);
        await c.miss();
      }
    }
    expect(armed).toBe(true);
    expect(checked).toBe(true);
    expect(await c.overlayTitle()).toBe('P1 wins');
    expect(await c.overlayBody()).toMatch(/^\d+ to 0\.$/);
    await c.press('Rematch');
    await expect(c.overlay).toBeVisible();
  });

  test('a tie goes to sudden death', async ({ page }) => {
    await open(page);
    const c = court(page);
    await c.pick('sabotage');
    let shots = 0;
    for (let guard = 0; guard < 40; guard++) {
      await expect(c.overlay).toBeVisible();
      const title = await c.overlayTitle();
      if (title.includes('wins')) break;
      if (title.includes('power-up')) { await c.press('Save it'); continue; }
      await c.press('Ready');
      shots++;
      if (shots <= 10) await c.miss(); // 0-0 after ten shots
      else if ((await c.state()).tag === 'P2') await c.make();
      else await c.miss();
    }
    expect(shots).toBe(12);
    expect(await c.overlayTitle()).toBe('P2 wins');
  });
});
