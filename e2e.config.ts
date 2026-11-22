import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

// End-to-end tests (tests/e2e/*.e2e.ts) against the production build served by `vite preview`.
// All steps are scripted, so no model is configured. Run with `npm run test:e2e`.
export default {
  tests: 'tests/e2e/**/*.e2e.ts',
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 2,
  timeout: 60_000,
  retries: 0,
  trace: 'retain-on-failure',
  targets: [{
    name: 'desktop',
    engine: web({ viewport: { width: 1100, height: 800 } }),
    app: {
      url: 'http://localhost:4173',
      command: { executable: 'npx', args: ['vite', 'preview', '--port', '4173', '--strictPort'], reuseExisting: true },
    },
  }],
} satisfies E2EConfig;
