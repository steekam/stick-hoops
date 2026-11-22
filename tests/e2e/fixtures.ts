import { test as base, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

// Port of tests/e2e/fixtures.ts. e2e has no page.on('pageerror'), so an init script records
// uncaught errors on window and every test checks the list at the end.

type Storage = Record<string, unknown>;

const ERROR_TRAP = `(() => {
  window.__errs = [];
  addEventListener('error', (e) => window.__errs.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason)));
})();`;

export const test = base.extend<{ errors: void }>({
  errors: [
    async ({ browser }, use) => {
      await browser.addInitScript(ERROR_TRAP);
      await use();
      const errs = await browser.evaluate(() => (window as unknown as { __errs?: string[] }).__errs ?? []);
      expect(errs, 'page errors').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export async function open(browser: Browser, opts: { tutorialDone?: boolean; storage?: Storage } = {}): Promise<void> {
  const seed: Storage = { ...(opts.tutorialDone === false ? {} : { tutorialDone: true }), ...(opts.storage ?? {}) };
  await browser.addInitScript(`(() => {
    try { sessionStorage.length; } catch { return; } // about:blank before the first navigation
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.clear();
    const s = ${JSON.stringify(seed)};
    for (const [k, v] of Object.entries(s)) localStorage.setItem('sh_' + k, JSON.stringify(v));
  })();`);
  await browser.goto('/?e2e');
  await waitForHooks(browser);
}

export async function waitForHooks(browser: Browser): Promise<void> {
  await expect.poll(() => browser.evaluate(() => !!(window as unknown as { __test?: unknown }).__test)).toBe(true);
}

type State = {
  mode: string | null; tick: number; px: number; tag: string; variant: number;
  world: { wind: number; rimW: number; wall: unknown; hoop: { mx: number; my: number; sp: number; by: number } };
  ball: boolean; fig: string; canShoot: boolean;
};

/** browser.evaluate with loose types: arguments and results are JSON either way. */
export function evaluate<T>(browser: Browser, fn: (arg: any) => unknown, arg?: unknown): Promise<T> {
  return (browser.evaluate as unknown as (f: (a: any) => unknown, a?: unknown) => Promise<T>)(fn, arg);
}

function call<T>(browser: Browser, name: string, ...args: unknown[]): Promise<T> {
  return evaluate<T>(
    browser,
    ([n, a]: [string, unknown[]]) => (window as unknown as { __test: Record<string, (...x: unknown[]) => unknown> }).__test[n](...a),
    [name, args],
  );
}

export function court(browser: Browser) {
  return {
    make: async (kind: 'any' | 'swish' | 'dirty' = 'any') => { const r = await call<{ made: boolean }>(browser, 'shootMake', kind); await call(browser, 'settle'); return r; },
    miss: async () => { await call(browser, 'shootMiss'); await call(browser, 'settle'); },
    settle: () => call<number>(browser, 'settle'),
    advance: (sec: number) => call(browser, 'advance', sec),
    shoot: (vx: number, vy: number) => call(browser, 'shoot', vx, vy),
    state: () => call<State>(browser, 'state'),
    overlay: browser.locator('#overlay'),
    overlayTitle: async () => (await browser.locator('#ov-title').textContent()) ?? '',
    overlayBody: async () => (await browser.locator('#ov-body').textContent()) ?? '',
    press: (label: string) => browser.locator('#ov-btns button').filter({ hasText: label }).click(),
    pick: (modeId: string) => browser.locator(`#mode-${modeId}`).click(),
    menu: () => browser.locator('#btn-menu').click(),
  };
}
