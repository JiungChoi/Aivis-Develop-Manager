import { randomUUID } from 'node:crypto';

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

// In-memory approval store. Swap for SQLite/Redis if persistence is needed.
const tasks = new Map<string, Task>();

export const approvals = {
  create(title: string, detail?: string): Task {
    const id = randomUUID().slice(0, 8);
    const task: Task = { id, title, detail, decision: 'pending', createdAt: new Date().toISOString() };
    tasks.set(id, task);
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
    }
    return task;
  },
  markExecuted(id: string): Task | undefined {
    const task = tasks.get(id);
    if (task) {
      task.executed = true;
      task.executedAt = new Date().toISOString();
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
};
