# Deploying

Everything runs on free tiers: Cloudflare Pages for the game and a Cloudflare Worker for
feedback.

## The game: Cloudflare Pages

The Pages project `stick-hoops` is connected to this repo:

- A push to `main` builds and deploys **https://stick-hoops.pages.dev**.
- Every other branch and pull request gets a preview deployment, with a link commented on the PR.
- Build command `npm run build`, output `dist`, Node 22. Changes only to `docs/`, `promo/` or
  Markdown files don't trigger a build.

Build-time environment variables (set on the Pages project, production and preview):

| Variable | Value | Used for |
| --- | --- | --- |
| `VITE_FEEDBACK_URL` | `https://stick-hoops-feedback.steekam.workers.dev` | Where the feedback form posts. Without it, the form offers a prefilled GitHub issue link. |
| `VITE_SITE_URL` | `https://stick-hoops.pages.dev/` (in `.env`) | Share links and the social card's absolute URL. Keep the trailing slash. |

### Caching and offline

`public/_headers` caches the hashed build files for a year and always revalidates the page and
the service worker, so a release shows up on the next visit. `public/sw.js` makes the game work
offline after the first visit. It's registered as `sw.js?v=<version>`, so bumping the version in
`package.json` gives each release a fresh cache and deletes the old one.

## Feedback Worker

`worker/feedback/` is a Cloudflare Worker, `stick-hoops-feedback`, that files each report as a
labelled GitHub issue (`bug`, `idea` or `feedback`, plus `from-game`), so players don't need a
GitHub account. It accepts requests only from the origins in `ALLOWED_ORIGINS`, caps the body at
16 KB, keeps a honeypot field and a minimum time on the form, allows 5 reports per IP per 10
minutes, and stops player text from @-mentioning anyone or linking issues.

**It needs a GitHub token before it files anything.** Until then it answers 503 and the game
offers its prefilled GitHub link instead. To turn it on:

1. Make a fine-grained token (GitHub → Settings → Developer settings → Fine-grained tokens) with
   access to only `steekam/stick-hoops` and the single permission **Issues: Read and write**.
2. Add it to the Worker: Cloudflare dashboard → Workers → stick-hoops-feedback → Settings →
   Variables and secrets → add a **Secret** named `GITHUB_TOKEN`. Or, from `worker/feedback/`:
   `npx wrangler secret put GITHUB_TOKEN`.
3. Optional: create the labels `bug`, `idea`, `feedback` and `from-game` in the repo so they get
   colours. Otherwise the first report creates them.

To redeploy the Worker after changing it: `cd worker/feedback && npx wrangler deploy`.

## The claude.ai preview

`npm run build:preview` inlines the whole game into one HTML file (`dist-preview/artifact.html`)
for publishing as a Claude artifact. The preview skips the service worker, and its feedback form
always uses the GitHub link.
