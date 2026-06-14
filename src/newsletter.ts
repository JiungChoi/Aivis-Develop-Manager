import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { RepoStatus } from './types.js';

// The manager can't send Kakao itself (PlayMCP is the loop claude's tool). So it
// composes a ≤200-char digest and tracks what's been sent; the loop reads it and
// fires the actual MemoChat. See scripts/dev-loop-prompt.md step 0.5.

export type Period = 'daily' | 'weekly';
export interface NewsletterCounts {
  done: number;
  progress: number;
  pendingApprovals: number;
}

const MAX = 200; // MemoChat body limit

const shortName = (name: string) => name.replace('AIVIS Develop Manager', 'Mgr');
const digestOf = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 12);

/** Build the ≤200-char Korean digest, dropping repo lines if over budget. */
export function composeText(repos: RepoStatus[], c: NewsletterCounts): string {
  const d = new Date();
  const head = `🦖 AIVIS 현황 ${d.getMonth() + 1}/${d.getDate()}`;
  const counts = `완료${c.done}·진행${c.progress}·승인대기${c.pendingApprovals}`;
  const repoLines = repos.map((r) => {
    const ahead = r.developAheadOfMain ? ` develop+${r.developAheadOfMain}` : '';
    const ci = r.ci === 'passing' ? '✅' : r.ci === 'failing' ? '❌' : '';
    const pr = r.openPRs.length ? ` PR${r.openPRs.length}${ci}` : '';
    return `${shortName(r.name)}${ahead}${pr}`;
  });
  const lines = [head, counts, ...repoLines, '▶ 대시보드 확인'];
  let text = lines.join('\n');
  while (text.length > MAX && lines.length > 3) {
    lines.splice(lines.length - 2, 1); // drop the last repo line (keep the CTA)
    text = lines.join('\n');
  }
  return text.length <= MAX ? text : text.slice(0, MAX - 1) + '…';
}

export function createNewsletter(statePath: string) {
  let sent: Record<string, { digest: string; at: string }> = {};
  try { sent = JSON.parse(readFileSync(statePath, 'utf8')); } catch { /* first run */ }

  const persist = () => {
    try {
      mkdirSync(dirname(statePath), { recursive: true });
      writeFileSync(statePath, JSON.stringify(sent, null, 2));
    } catch { /* best effort — dedup degrades to per-process */ }
  };

  // daily: same calendar day; weekly: within 7 days.
  const sameWindow = (at: string, period: Period) => {
    const a = new Date(at);
    const now = new Date();
    if (period === 'weekly') return now.getTime() - a.getTime() < 7 * 86_400_000;
    return a.toDateString() === now.toDateString();
  };

  return {
    build(text: string, period: Period) {
      return { text, digest: digestOf(text), period, generatedAt: new Date().toISOString() };
    },
    shouldSend(period: Period, text: string) {
      const last = sent[period];
      const already = Boolean(last && sameWindow(last.at, period));
      return { shouldSend: !already, reason: already ? 'already-sent-this-window' : 'due', text, digest: digestOf(text), period };
    },
    recordSent(period: Period, digest: string) {
      sent[period] = { digest, at: new Date().toISOString() };
      persist();
      return sent[period];
    },
  };
}
