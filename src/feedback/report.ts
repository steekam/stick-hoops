// A player report: a bug, an idea for a level or mode, or general feedback.
// Shared by the game (which builds it) and the Worker (which checks it and files a GitHub issue),
// so both apply the same limits.

export const KINDS = {
  bug: { label: 'Bug', title: 'Report a bug', prompt: 'What went wrong? What did you expect?', ghLabel: 'bug' },
  idea: { label: 'Level or mode idea', title: 'Suggest a level or mode', prompt: 'Describe the level or mode: the court, the rules, what makes it fun.', ghLabel: 'idea' },
  feedback: { label: 'Feedback', title: 'Send feedback', prompt: 'Tell us what you think.', ghLabel: 'feedback' },
} as const;

export type Kind = keyof typeof KINDS;

export const LIMITS = { message: 2000, contact: 80, minMessage: 10 } as const;

/** What the game knows when the report is sent. Attached only if the player leaves it ticked. */
export interface ReportContext {
  version: string;
  mode: string | null;
  hud: string;
  backdrop: string;
  scoreboard: boolean;
  viewport: string;
  userAgent: string;
  /** Last few uncaught errors, newest last. */
  errors: string[];
}

export interface Report {
  kind: Kind;
  message: string;
  /** Optional name, handle or email so we can follow up. */
  contact?: string;
  context?: ReportContext;
  /** Honeypot: a hidden field people never fill in. Anything here means a bot. */
  website?: string;
  /** ms the form was open before sending. Bots submit instantly. */
  elapsedMs?: number;
}

export type Check = { ok: true; report: Report } | { ok: false; error: string };

const isKind = (k: unknown): k is Kind => typeof k === 'string' && k in KINDS;
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Validate and trim an untrusted report. Used by the Worker on every request. */
export function checkReport(input: unknown): Check {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Send a report as JSON.' };
  const r = input as Record<string, unknown>;
  if (!isKind(r.kind)) return { ok: false, error: 'Pick bug, idea or feedback.' };
  if (typeof r.website === 'string' && r.website.trim()) return { ok: false, error: 'spam' };
  if (typeof r.elapsedMs === 'number' && r.elapsedMs < 2500) return { ok: false, error: 'spam' };
  const message = str(r.message, LIMITS.message).trim();
  if (message.length < LIMITS.minMessage) return { ok: false, error: `Write at least ${LIMITS.minMessage} characters.` };
  const contact = str(r.contact, LIMITS.contact).trim() || undefined;
  let context: ReportContext | undefined;
  if (r.context && typeof r.context === 'object') {
    const c = r.context as Record<string, unknown>;
    context = {
      version: str(c.version, 40),
      mode: typeof c.mode === 'string' ? c.mode.slice(0, 40) : null,
      hud: str(c.hud, 160),
      backdrop: str(c.backdrop, 20),
      scoreboard: c.scoreboard === true,
      viewport: str(c.viewport, 20),
      userAgent: str(c.userAgent, 300),
      errors: Array.isArray(c.errors) ? c.errors.slice(-5).map((e) => str(e, 300)) : [],
    };
  }
  return { ok: true, report: { kind: r.kind, message, contact, context } };
}

/** Stop GitHub from pinging people or linking issues because of what a player typed. */
const defuse = (s: string): string => s.replace(/@/g, '@​').replace(/#(\d)/g, '#​$1');

/** Turn a checked report into a GitHub issue title, body and labels. */
export function toIssue(r: Report): { title: string; body: string; labels: string[] } {
  const k = KINDS[r.kind];
  const first = r.message.split('\n')[0].replace(/\s+/g, ' ').trim();
  const title = `[${k.label}] ${first.length > 70 ? first.slice(0, 67) + '...' : first}`;
  const lines = [`**From a player, sent from the game.**`, '', defuse(r.message)];
  if (r.contact) lines.push('', `**Contact:** ${defuse(r.contact)}`);
  if (r.context) {
    const c = r.context;
    lines.push(
      '', '<details><summary>Game context</summary>', '',
      `- Version: ${c.version}`,
      `- Mode: ${c.mode ?? 'menu'}`,
      `- Scoreboard text: ${defuse(c.hud) || '(none)'}`,
      `- Backdrop: ${c.backdrop}${c.scoreboard ? ' + scoreboard' : ''}`,
      `- Viewport: ${c.viewport}`,
      `- Browser: ${defuse(c.userAgent)}`,
    );
    if (c.errors.length) lines.push('', 'Recent errors:', '```', ...c.errors.map((e) => e.replace(/```/g, "'''")), '```');
    lines.push('', '</details>');
  }
  return { title: defuse(title), body: lines.join('\n'), labels: [k.ghLabel, 'from-game'] };
}

/** A prefilled "new issue" link: the fallback when no Worker is configured (or it is down). */
export function issueLink(repo: string, r: Report): string {
  const { title, body, labels } = toIssue(r);
  const q = new URLSearchParams({ title, body: body.slice(0, 6000), labels: labels.join(',') });
  return `https://github.com/${repo}/issues/new?${q}`;
}
