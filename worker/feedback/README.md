# Feedback Worker

Players send bug reports, level or mode ideas and feedback from the game. This Worker files each one
as a labelled GitHub issue (`bug`, `idea` or `feedback`, plus `from-game`). Players need no account.

Cost: $0. Cloudflare Workers' free plan allows 100,000 requests a day; GitHub issues are free.

## Set up (once)

1. **GitHub token.** github.com → Settings → Developer settings → Fine-grained tokens → Generate.
   Repository access: only `steekam/stick-hoops`. Permissions: **Issues: Read and write**. Nothing else.
2. **Labels.** Create `bug`, `idea`, `feedback` and `from-game` in the repo (Issues → Labels), or the
   first report creates them unstyled.
3. **Deploy** (free Cloudflare account):
   ```
   cd worker/feedback
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN   # paste the token
   npx wrangler deploy
   ```
   Wrangler prints the Worker's URL, e.g. `https://stick-hoops-feedback.<you>.workers.dev`.
4. **Allow your site.** Put the game's real origin(s) in `ALLOWED_ORIGINS` in `wrangler.toml`, deploy again.
5. **Point the game at it.** Build with `VITE_FEEDBACK_URL=https://stick-hoops-feedback.<you>.workers.dev`
   (in Cloudflare Pages: Settings → Environment variables).

Until step 5, the game falls back to a prefilled "new issue" link on GitHub, which works but needs the
player to have a GitHub account. The same fallback is used if the Worker is down.

## Spam

- A hidden honeypot field and a minimum time on the form; bots get a quiet fake "thanks".
- At most 5 reports per IP per 10 minutes. This lives in Worker memory, so it is best effort.
- Requests only from the origins in `ALLOWED_ORIGINS`; body capped at 16 KB; text capped and trimmed.
- Player text cannot @-mention anyone or link other issues.

If spam ever gets through, add Cloudflare Turnstile (also free) to the form.
