import { court, evaluate, expect, open, test } from './fixtures';

// The upright-phone follow camera. Desktop and landscape keep the whole court.
type V = { x: number; y: number; w: number; h: number };
const view = (b: Parameters<typeof open>[0]) => evaluate<V>(b, () => (window as unknown as { __test: { view(): unknown } }).__test.view());

test('Portrait phone: the camera shows part of the world and a drag in the pad shoots toward the hoop', async ({ browser }) => {
  await browser.setViewport({ width: 390, height: 844 });
  await open(browser);
  const c = court(browser);
  await c.pick('practice');
  await expect.poll(async () => (await view(browser)).w).not.toBe(960);
  const v = await view(browser);
  expect(v.h).toBeGreaterThan(v.w); // a tall view
  const box = (await browser.locator('#court').boundingBox())!;
  // Press in the pad, well below the floor, and pull down and to the left.
  const x = box.x + box.width * 0.7, y = box.y + box.height * 0.88;
  await browser.mouse.move(x, y);
  await browser.mouse.down();
  for (let i = 1; i <= 8; i++) await browser.mouse.move(x - (50 * i) / 8, y + (60 * i) / 8);
  await browser.mouse.up();
  const st = await c.state();
  expect(st.ball).toBe(true);
  const ball = await evaluate<{ vx: number; vy: number } | null>(browser, () => (window as unknown as { __test: { ball(): unknown } }).__test.ball());
  expect(ball!.vx).toBeGreaterThan(0);
  expect(ball!.vy).toBeLessThan(0);
  await c.settle();
});

test('Desktop: the view is the full court', async ({ browser }) => {
  await browser.setViewport({ width: 1280, height: 800 });
  await open(browser);
  await court(browser).pick('practice');
  expect(await view(browser)).toEqual({ x: 0, y: 0, w: 960, h: 540 });
});
