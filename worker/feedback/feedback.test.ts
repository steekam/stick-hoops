import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkReport, issueLink, toIssue } from '../../src/feedback/report';
import worker, { rateLimited, type Env } from './index';

const env: Env = { GITHUB_TOKEN: 't0ken', GITHUB_REPO: 'steekam/stick-hoops', ALLOWED_ORIGINS: 'https://game.test' };
const good = { kind: 'bug', message: 'The ball went through the backboard on level 4.', elapsedMs: 9000 };

function post(body: unknown, opts: { origin?: string; ip?: string; raw?: string } = {}) {
  return new Request('https://worker.test/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: opts.origin ?? 'https://game.test', 'CF-Connecting-IP': opts.ip ?? `ip-${Math.random()}` },
    body: opts.raw ?? JSON.stringify(body),
  });
}

describe('checkReport', () => {
  it('accepts a normal report and trims it', () => {
    const r = checkReport({ ...good, message: `  ${good.message}  `, contact: '  sam  ' });
    expect(r.ok && r.report.message).toBe(good.message);
    expect(r.ok && r.report.contact).toBe('sam');
  });
  it('rejects unknown kinds, short messages and non-objects', () => {
    expect(checkReport({ ...good, kind: 'rant' }).ok).toBe(false);
    expect(checkReport({ ...good, message: 'too short' }).ok).toBe(false);
    expect(checkReport('hello').ok).toBe(false);
  });
  it('flags the honeypot and instant submits as spam', () => {
    expect(checkReport({ ...good, website: 'http://spam' })).toEqual({ ok: false, error: 'spam' });
    expect(checkReport({ ...good, elapsedMs: 300 })).toEqual({ ok: false, error: 'spam' });
  });
  it('caps long text and keeps only the last five errors', () => {
    const r = checkReport({ ...good, message: 'x'.repeat(5000), context: { errors: Array.from({ length: 9 }, (_, i) => `e${i}`) } });
    expect(r.ok && r.report.message.length).toBe(2000);
    expect(r.ok && r.report.context?.errors).toEqual(['e4', 'e5', 'e6', 'e7', 'e8']);
  });
});

describe('toIssue', () => {
  it('labels by kind and never pings or links through player text', () => {
    const r = checkReport({ ...good, kind: 'idea', message: 'A level with two hoops @octocat see #12' });
    const issue = toIssue(r.ok ? r.report : (null as never));
    expect(issue.labels).toEqual(['idea', 'from-game']);
    expect(issue.title.startsWith('[Level or mode idea]')).toBe(true);
    expect(issue.body).not.toMatch(/@octocat/);
    expect(issue.body).not.toMatch(/#12/);
  });
  it('builds a prefilled GitHub link as the fallback', () => {
    const r = checkReport(good);
    const url = new URL(issueLink('steekam/stick-hoops', r.ok ? r.report : (null as never)));
    expect(url.pathname).toBe('/steekam/stick-hoops/issues/new');
    expect(url.searchParams.get('labels')).toBe('bug,from-game');
  });
});

describe('worker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('files a GitHub issue and returns its number', async () => {
    const gh = vi.fn(async () => new Response(JSON.stringify({ number: 42 }), { status: 201 }));
    vi.stubGlobal('fetch', gh);
    const res = await worker.fetch(post(good), env);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, number: 42 });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://game.test');
    const [url, init] = gh.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/steekam/stick-hoops/issues');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0ken');
  });

  it('refuses other sites, and answers the CORS preflight only for the game', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await worker.fetch(post(good, { origin: 'https://evil.test' }), env)).status).toBe(403);
    const pre = (o: string) => worker.fetch(new Request('https://worker.test/', { method: 'OPTIONS', headers: { Origin: o } }), env);
    expect((await pre('https://game.test')).status).toBe(204);
    expect((await pre('https://evil.test')).status).toBe(403);
  });

  it('gives bots a fake thanks without calling GitHub', async () => {
    const gh = vi.fn();
    vi.stubGlobal('fetch', gh);
    const res = await worker.fetch(post({ ...good, website: 'buy now' }), env);
    expect(res.status).toBe(200);
    expect(gh).not.toHaveBeenCalled();
  });

  it('rejects bad JSON, oversize bodies and bad reports with a reason', async () => {
    vi.stubGlobal('fetch', vi.fn());
    expect((await worker.fetch(post(null, { raw: '{nope' }), env)).status).toBe(400);
    expect((await worker.fetch(post(null, { raw: 'x'.repeat(20_000) }), env)).status).toBe(413);
    const res = await worker.fetch(post({ ...good, message: 'short' }), env);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least/);
  });

  it('reports a GitHub failure as 502 so the game can fall back', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect((await worker.fetch(post(good), env)).status).toBe(502);
  });

  it('allows five reports per IP per ten minutes', () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) expect(rateLimited('1.2.3.4', t + i)).toBe(false);
    expect(rateLimited('1.2.3.4', t + 10)).toBe(true);
    expect(rateLimited('1.2.3.4', t + 11 * 60_000)).toBe(false);
  });
});
