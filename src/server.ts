import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PORT } from './config.js';
import { approvals, type Decision } from './approvals.js';
import { notifier } from './notifier.js';
import { credentials, projects, activity } from './board.js';

const app = express();
app.use(express.json());

// ── Static newsletter dashboard (public/) ───────────────────────
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

// Aggregated board data for the dashboard.
app.get('/api/board', (_req: Request, res: Response) => {
  res.json({
    credentials,
    projects,
    activity,
    approvals: approvals.list(),
    generatedAt: new Date().toISOString(),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dev process proposes the next task → notify user, create pending approval.
app.post('/api/tasks', async (req: Request, res: Response) => {
  const { title, detail } = req.body ?? {};
  if (!title || typeof title !== 'string') {
    res.status(400).json({ error: 'title (string) required' });
    return;
  }
  const task = approvals.create(title, detail);
  try {
    await notifier.proposeTask(task);
  } catch (err) {
    console.error('notify failed', err);
  }
  res.json(task);
});

// Dev process polls the decision.
app.get('/api/tasks/:id', (req: Request, res: Response) => {
  const task = approvals.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json(task);
});

// Approve / decline via link (used by Kakao outbound).
function decideViaLink(decision: Exclude<Decision, 'pending'>) {
  return (req: Request, res: Response) => {
    const task = approvals.resolve(req.params.id, decision);
    if (!task) {
      res.status(404).send('not found');
      return;
    }
    const label = decision === 'approved' ? '진행' : '중단';
    res.send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0b12;color:#eee;text-align:center;padding-top:60px">
      <h2>✅ ${label} 처리됨</h2><p>${task.title}</p></body>`);
  };
}
app.get('/api/tasks/:id/approve', decideViaLink('approved'));
app.get('/api/tasks/:id/decline', decideViaLink('declined'));

app.listen(PORT, () => console.log(`aivis-manager listening on :${PORT} (dashboard: ${'/'})`));
