import { court, evaluate, expect, open, test } from './fixtures';

// The test build has no VITE_FEEDBACK_URL, so sending falls back to a prefilled GitHub issue.

test('Feedback: the header button opens the form, Escape closes it and play resumes', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  await browser.locator('#btn-feedback').click();
  await expect(browser.locator('#feedback')).toBeVisible();
  expect((await c.state()).canShoot).toBe(false);
  await browser.keyboard.press('Escape');
  await expect(browser.locator('#feedback')).toBeHidden();
  expect((await c.state()).canShoot).toBe(true);
});

test('Feedback: a too-short message is caught before sending', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-feedback').click();
  await browser.locator('#fb-message').fill('meh');
  await browser.locator('#fb-send').click();
  await expect(browser.locator('#fb-status')).toContainText(/at least 10/i);
  await expect(browser.locator('#fb-github')).toHaveCount(0);
});

test('Feedback: a bug report falls back to a prefilled GitHub issue with game details', async ({ browser }) => {
  await open(browser);
  const c = court(browser);
  await c.pick('streak');
  await browser.locator('#btn-feedback').click();
  await browser.locator('#fb-kind-bug').click();
  await expect(browser.locator('#fb-title')).toHaveText(/report a bug/i);
  await browser.locator('#fb-message').fill('The ball clipped through the rim on my third shot.');
  await browser.locator('#fb-send').click();
  await expect(browser.locator('#fb-github')).toBeVisible();
  const href = (await browser.locator('#fb-github').getAttribute('href'))!;
  const url = new URL(href);
  expect(url.pathname).toBe('/steekam/stick-hoops/issues/new');
  expect(url.searchParams.get('labels')).toBe('bug,from-game');
  expect(url.searchParams.get('title')).toContain('ball clipped through the rim');
  const body = url.searchParams.get('body')!;
  expect(body).toContain('Mode: streak');
  expect(body).toContain('Backdrop:');
});

test('Feedback: unticking game details leaves them out', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-feedback').click();
  await browser.locator('#fb-message').fill('Loving the pencil look, keep it.');
  await browser.locator('#fb-attach').click();
  await browser.locator('#fb-send').click();
  const body = new URL((await browser.locator('#fb-github').getAttribute('href'))!).searchParams.get('body')!;
  expect(body).not.toContain('Game context');
});

test('Feedback: the menu link opens a level idea, and switching type keeps the text', async ({ browser }) => {
  await open(browser);
  await browser.locator('#btn-idea').click();
  await expect(browser.locator('#fb-title')).toHaveText(/suggest a level or mode/i);
  await browser.locator('#fb-message').fill('A level where the hoop sits on a moving truck.');
  await browser.locator('#fb-kind-feedback').click();
  await expect(browser.locator('#fb-title')).toHaveText(/send feedback/i);
  expect(await evaluate<string>(browser, () => (document.getElementById('fb-message') as HTMLTextAreaElement).value)).toContain('moving truck');
});
