import { checkReport, toIssue } from '../../src/feedback/report';

// Cloudflare Worker: receives a report from the game and files it as a GitHub issue.
// Runs on the free plan (100k requests/day). Setup and secrets: see worker/feedback/README.md.

export interface Env {
  /** Fine-grained GitHub token with Issues: read and write on this one repository. Secret. */
  GITHUB_TOKEN: string;
  /** "owner/repo" to file issues in. */
  GITHUB_REPO: string;
  /** Comma-separated origins allowed to post, e.g. "https://stickhoops.pages.dev". */
  ALLOWED_ORIGINS: string;
}

const MAX_BODY = 16_000;
/** Per-IP limit, kept in this Worker instance's memory: best effort, no paid storage needed. */
const WINDOW_MS = 10 * 60_000, PER_WINDOW = 5;
const hits = new Map<string, number[]>();

export function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // never grow without bound
  return recent.length > PER_WINDOW;
}

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return {};
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
}

const json = (status: number, data: unknown, headers: Record<string, string>) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    const h = cors(origin, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: h['Access-Control-Allow-Origin'] ? 204 : 403, headers: h });
    if (req.method !== 'POST') return json(405, { error: 'POST a report.' }, h);
    if (!h['Access-Control-Allow-Origin']) return json(403, { error: 'Unknown site.' }, h);

    const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (rateLimited(ip)) return json(429, { error: 'Too many reports. Try again in a few minutes.' }, h);

    const text = await req.text();
    if (text.length > MAX_BODY) return json(413, { error: 'That report is too long.' }, h);
    let data: unknown;
    try { data = JSON.parse(text); } catch { return json(400, { error: 'Send a report as JSON.' }, h); }

    const check = checkReport(data);
    // Bots get a quiet "thanks" so they learn nothing.
    if (!check.ok) return check.error === 'spam' ? json(200, { ok: true }, h) : json(400, { error: check.error }, h);

    const issue = toIssue(check.report);
    const gh = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'stick-hoops-feedback',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issue),
    });
    if (!gh.ok) return json(502, { error: 'Could not file the report right now.' }, h);
    const made = (await gh.json()) as { number: number };
    return json(201, { ok: true, number: made.number }, h);
  },
};
