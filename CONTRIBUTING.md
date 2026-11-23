# Contributing

Bug reports and level or mode ideas are welcome. The quickest way is the Feedback button in the
game; issues and pull requests here work too.

For code changes:

1. `npm install`, then `npm run dev`.
2. Keep `src/sim` deterministic. [The rules](docs/architecture.md#determinism-rules-for-srcsim)
   are short; the golden snapshot test catches most slips.
3. A new mode implements the `Mode` interface (`src/game/types.ts`) and is added to
   `src/modes/registry.ts`. Give it an e2e test that plays it to the end with the `__test` hooks
   (see [testing](docs/testing.md)).
4. Run `npm run typecheck && npm test && npm run test:e2e` before opening a PR. Pull requests get
   a preview deployment on Cloudflare Pages.
