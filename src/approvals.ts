import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Stats } from './types.js';

export type Decision = 'pending' | 'approved' | 'declined';

export interface Task {
  id: string;
  title: string;
  detail?: string;
  decision: Decision;
  createdAt: string;
  decidedAt?: string;
  /** Set once the dev loop has actually carried out an approved task. */
  executed?: boolean;
  executedAt?: string;
}

// Approval ledger persisted to data/approvals.json so pending proposals (and the
// Kakao approve links pointing at them) survive a manager restart/crash.
const STATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'approvals.json');
const tasks = new Map<string, Task>();
try {
  for (const t of JSON.parse(readFileSync(STATE, 'utf8')) as Task[]) tasks.set(t.id, t);
} catch { /* first run / no file */ }

function persist(): void {
  try {
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, JSON.stringify([...tasks.values()], null, 2));
  } catch { /* best effort */ }
}

export const approvals = {
  create(title: string, detail?: string): Task {
    const id = randomUUID().slice(0, 8);
    const task: Task = { id, title, detail, decision: 'pending', createdAt: new Date().toISOString() };
    tasks.set(id, task);
    persist();
    return task;
  },
  get(id: string): Task | undefined {
    return tasks.get(id);
  },
  resolve(id: string, decision: Exclude<Decision, 'pending'>): Task | undefined {
    const task = tasks.get(id);
    if (task && task.decision === 'pending') {
      task.decision = decision;
      task.decidedAt = new Date().toISOString();
      persist();
    }
    return task;
  },
  markExecuted(id: string): Task | undefined {
    const task = tasks.get(id);
    if (task) {
      task.executed = true;
      task.executedAt = new Date().toISOString();
      persist();
    }
    return task;
  },
  /** Approved but not yet carried out — the next dev cycle should resume these. */
  pendingExecution(): Task[] {
    return [...tasks.values()].filter((t) => t.decision === 'approved' && !t.executed);
  },
  list(): Task[] {
    return [...tasks.values()];
  },
  /** Aggregate ledger stats for the dashboard (throughput, lead time, success rate). */
  stats(): Stats {
    const all = [...tasks.values()];
    const approved = all.filter((t) => t.decision === 'approved');
    const declined = all.filter((t) => t.decision === 'declined');
    const executed = all.filter((t) => t.executed && t.executedAt);

    const DAY = 86_400_000;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const throughput7d = new Array(7).fill(0);
    for (const t of executed) {
      const dayStart = new Date(t.executedAt!).setHours(0, 0, 0, 0);
      const idx = 6 - Math.round((startOfToday - dayStart) / DAY);
      if (idx >= 0 && idx < 7) throughput7d[idx]++;
    }

    const leads = executed
      .filter((t) => t.decidedAt)
      .map((t) => (Date.parse(t.executedAt!) - Date.parse(t.decidedAt!)) / 1000);
    const avgLeadTimeSec = leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : 0;

    return {
      throughput7d,
      approvedTotal: approved.length,
      declinedTotal: declined.length,
      avgLeadTimeSec,
      successRate: approved.length ? executed.length / approved.length : 0,
    };
  },
};
