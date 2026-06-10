import { randomUUID } from 'node:crypto';

export type Decision = 'pending' | 'approved' | 'declined';

export interface Task {
  id: string;
  title: string;
  detail?: string;
  decision: Decision;
  createdAt: string;
  decidedAt?: string;
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
  list(): Task[] {
    return [...tasks.values()];
  },
};
