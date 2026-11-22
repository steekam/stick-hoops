import { test as base, expect, type Page } from '@playwright/test';

type Storage = Record<string, unknown>;

/** Every test fails if the page throws, even when its own assertions pass. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await use(errors);
      expect(errors, 'page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

/**
 * Open the game on a clean device. Storage is seeded once per test; reloads keep it, so
 * persistence can be checked. `tutorialDone` defaults to true so most tests start at the menu.
 */
export async function open(page: Page, opts: { tutorialDone?: boolean; storage?: Storage } = {}): Promise<void> {
  const seed: Storage = { ...(opts.tutorialDone === false ? {} : { tutorialDone: true }), ...(opts.storage ?? {}) };
  await page.addInitScript((s: Storage) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem('sh_' + k, JSON.stringify(v));
  }, seed);
  await page.goto('/?e2e');
  await page.waitForFunction(() => !!(window as unknown as { __test?: unknown }).__test);
}

type Hooks = {
  shootMake(kind?: 'any' | 'swish' | 'dirty'): { made: boolean; swish: boolean };
  shootRimOut(): { rimOut: boolean };
  shootMiss(): void;
  shoot(vx: number, vy: number): void;
  settle(): number;
  advance(sec: number): void;
  canShoot(): boolean;
  state(): { mode: string | null; tick: number; px: number; tag: string; variant: number; world: { wind: number; rimW: number; wall: unknown; hoop: { mx: number; my: number; sp: number; by: number } }; ball: boolean; fig: string; canShoot: boolean };
};

const call = <K extends keyof Hooks>(page: Page, k: K, ...args: Parameters<Hooks[K]>) =>
  page.evaluate(
    ([k, args]) => (window as unknown as { __test: Record<string, (...a: unknown[]) => unknown> }).__test[k as string](...(args as unknown[])),
    [k, args] as const,
  ) as Promise<ReturnType<Hooks[K]>>;

/** Shot and court helpers. Each shot settles fully, so the next call sees the result. */
export function court(page: Page) {
  const h = {
    make: async (kind: 'any' | 'swish' | 'dirty' = 'any') => { const r = await call(page, 'shootMake', kind); await call(page, 'settle'); return r; },
    rimOut: async () => { const r = await call(page, 'shootRimOut'); await call(page, 'settle'); return r; },
    miss: async () => { await call(page, 'shootMiss'); await call(page, 'settle'); },
    settle: () => call(page, 'settle'),
    advance: (sec: number) => call(page, 'advance', sec),
    state: () => call(page, 'state'),
    hud: () => page.locator('#hud').innerText(),
    overlay: page.locator('#overlay'),
    overlayTitle: () => page.locator('#ov-title').innerText(),
    overlayBody: () => page.locator('#ov-body').innerText(),
    press: (label: string) => page.locator('#ov-btns button', { hasText: label }).click(),
    pick: (modeId: string) => page.locator(`#mode-${modeId}`).click(),
    menu: () => page.locator('#btn-menu').click(),
  };
  return h;
}
