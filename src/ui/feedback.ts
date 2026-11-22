import { sfx } from '../audio/sfx';
import { issueLink, KINDS, LIMITS, type Kind, type Report, type ReportContext } from '../feedback/report';

// The feedback form: a panel over the court for bug reports, level or mode ideas, and feedback.
// Sends to the Worker at VITE_FEEDBACK_URL. With no Worker configured (or if it fails), it offers a
// prefilled GitHub issue instead, so a report is never lost.

const REPO = 'steekam/stick-hoops';
const ENDPOINT: string = import.meta.env.VITE_FEEDBACK_URL ?? '';

export interface FeedbackApi {
  open(kind?: Kind): void;
  close(): void;
  readonly isOpen: boolean;
}

/** Uncaught errors, newest last, so a bug report can include what just broke. */
const recentErrors: string[] = [];
addEventListener('error', (e) => { recentErrors.push(String(e.message)); if (recentErrors.length > 5) recentErrors.shift(); });

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, text?: string): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props) as HTMLElementTagNameMap[K];
  if (text != null) e.textContent = text;
  return e;
}

export function createFeedback(getContext: () => Omit<ReportContext, 'errors'>, onToggle: (open: boolean) => void): FeedbackApi {
  const root = document.getElementById('feedback')!;
  let open = false;
  let openedAt = 0;

  function form(kind: Kind): void {
    root.replaceChildren();
    const panel = el('form', { className: 'fb', noValidate: true });
    panel.setAttribute('aria-labelledby', 'fb-title');

    const top = el('div', { className: 'fb-top' });
    const h = el('h2', { id: 'fb-title' }, KINDS[kind].title);
    const close = el('button', { type: 'button', className: 'btn secondary', id: 'fb-close' }, 'Close');
    close.onclick = () => api.close();
    top.append(h, close);

    // What kind of report: three tabs.
    const kinds = el('div', { className: 'fb-kinds' });
    kinds.setAttribute('role', 'radiogroup');
    kinds.setAttribute('aria-label', 'Report type');
    for (const k of Object.keys(KINDS) as Kind[]) {
      const b = el('button', { type: 'button', id: `fb-kind-${k}`, className: 'fb-kind' }, KINDS[k].label);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(k === kind));
      b.onclick = () => { sfx.click(); keep(); form(k); restore(); };
      kinds.appendChild(b);
    }

    const msgLabel = el('label', { htmlFor: 'fb-message', className: 'fb-label' }, KINDS[kind].prompt);
    const msg = el('textarea', { id: 'fb-message', name: 'message', maxLength: LIMITS.message, rows: 5, required: true });
    const count = el('span', { className: 'fb-count', id: 'fb-count' });
    const updateCount = () => { count.textContent = `${msg.value.length}/${LIMITS.message}`; };
    msg.addEventListener('input', updateCount);

    const contactLabel = el('label', { htmlFor: 'fb-contact', className: 'fb-label' }, 'Name or email, if you want a reply (optional)');
    const contact = el('input', { id: 'fb-contact', name: 'contact', maxLength: LIMITS.contact, autocomplete: 'off' });

    const ctx = getContext();
    const attach = el('input', { type: 'checkbox', id: 'fb-attach', checked: true });
    const attachLabel = el('label', { htmlFor: 'fb-attach', className: 'fb-check' });
    attachLabel.append(attach, document.createTextNode(` Include game details (${ctx.mode ?? 'menu'}, ${ctx.backdrop}, ${ctx.viewport}, browser)`));

    // Honeypot: hidden from people, tempting to bots.
    const trap = el('input', { name: 'website', id: 'fb-website', tabIndex: -1, autocomplete: 'off' });
    const trapWrap = el('div', { className: 'fb-trap' });
    trapWrap.setAttribute('aria-hidden', 'true');
    trapWrap.append(trap);

    const status = el('p', { className: 'fb-status', id: 'fb-status' });
    status.setAttribute('role', 'status');
    const send = el('button', { type: 'submit', className: 'btn', id: 'fb-send' }, 'Send');
    const row = el('div', { className: 'fb-row' });
    row.append(send, status);

    const note = el('p', { className: 'fb-note' }, 'Reports become public issues on the game\'s GitHub page. Don\'t include anything private.');

    panel.append(top, kinds, msgLabel, msg, count, contactLabel, contact, attachLabel, trapWrap, row, note);
    root.appendChild(panel);
    updateCount();

    panel.onsubmit = async (e) => {
      e.preventDefault();
      const text = msg.value.trim();
      if (text.length < LIMITS.minMessage) {
        status.textContent = `Write at least ${LIMITS.minMessage} characters so we can act on it.`;
        status.dataset.tone = 'error';
        msg.focus();
        return;
      }
      const report: Report = {
        kind,
        message: text,
        contact: contact.value.trim() || undefined,
        context: attach.checked ? { ...getContext(), errors: [...recentErrors] } : undefined,
        website: trap.value,
        elapsedMs: Date.now() - openedAt,
      };
      send.disabled = true;
      status.dataset.tone = '';
      status.textContent = 'Sending…';
      const result = await submit(report);
      if (result.ok) { sfx.make(); thanks(kind, result.number); return; }
      send.disabled = false;
      fallback(report, result.reason);
    };
    msg.focus({ preventScroll: true });

    function fallback(r: Report, reason: string): void {
      status.dataset.tone = 'error';
      status.textContent = `${reason} You can post it on GitHub instead; it's filled in for you.`;
      const link = el('a', { className: 'btn secondary', id: 'fb-github', href: issueLink(REPO, r), target: '_blank', rel: 'noopener' }, 'Open on GitHub');
      if (!root.querySelector('#fb-github')) row.appendChild(link);
    }
  }

  // Keep what the player typed when they switch report type.
  let draft = { message: '', contact: '' };
  const keep = () => {
    draft = {
      message: (root.querySelector('#fb-message') as HTMLTextAreaElement | null)?.value ?? '',
      contact: (root.querySelector('#fb-contact') as HTMLInputElement | null)?.value ?? '',
    };
  };
  const restore = () => {
    const m = root.querySelector('#fb-message') as HTMLTextAreaElement, c = root.querySelector('#fb-contact') as HTMLInputElement;
    m.value = draft.message; c.value = draft.contact;
    m.dispatchEvent(new Event('input'));
  };

  function thanks(kind: Kind, number?: number): void {
    root.replaceChildren();
    const panel = el('div', { className: 'fb fb-done' });
    const h = el('h2', { id: 'fb-title' }, 'Thanks, got it');
    const p = el('p', {}, kind === 'bug'
      ? `We'll look into it${number ? ` (report #${number})` : ''}.`
      : kind === 'idea' ? `Your idea is in the pile${number ? ` (#${number})` : ''}. The good ones become levels.`
      : `Thanks for telling us${number ? ` (#${number})` : ''}.`);
    const back = el('button', { type: 'button', className: 'btn', id: 'fb-done' }, 'Back to the game');
    back.onclick = () => api.close();
    panel.append(h, p, back);
    root.appendChild(panel);
    back.focus();
    draft = { message: '', contact: '' };
  }

  async function submit(r: Report): Promise<{ ok: true; number?: number } | { ok: false; reason: string }> {
    if (!ENDPOINT) return { ok: false, reason: 'Sending from the game isn\'t set up here yet.' };
    try {
      const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
      const data = (await res.json().catch(() => ({}))) as { number?: number; error?: string };
      if (res.ok) return { ok: true, number: data.number };
      return { ok: false, reason: data.error ? `${data.error}` : 'The report didn\'t go through.' };
    } catch {
      return { ok: false, reason: 'Couldn\'t reach the server.' };
    }
  }

  root.addEventListener('keydown', (e) => { if (e.key === 'Escape') api.close(); });

  const api: FeedbackApi = {
    open(kind: Kind = 'feedback') {
      open = true; openedAt = Date.now(); root.hidden = false;
      form(kind);
      if (draft.message || draft.contact) restore();
      onToggle(true);
    },
    close() { keep(); open = false; root.hidden = true; root.replaceChildren(); onToggle(false); },
    get isOpen() { return open; },
  };
  return api;
}
