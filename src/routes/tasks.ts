import type { Express, Request, Response } from 'express';
import { APPROVAL_TOKEN } from '../config.js';
import { approvals, type Decision } from '../approvals.js';
import { notifier } from '../notifier.js';
import { events } from '../events.js';
import { triggerExecution } from '../runner.js';
import { withUrls } from '../links.js';

// Approve / decline via link (Kakao message) or the desktop pet.
function decideViaLink(decision: Exclude<Decision, 'pending'>) {
  return (req: Request, res: Response) => {
    if (APPROVAL_TOKEN && req.query.token !== APPROVAL_TOKEN) {
      res.status(403).send('forbidden: invalid or missing token');
      return;
    }
    const task = approvals.resolve(req.params.id, decision);
    if (!task) {
      res.status(404).send('not found');
      return;
    }
    events.emit('task:decided', task);
    if (decision === 'approved') triggerExecution(task.id);
    const label = decision === 'approved' ? '진행' : '중단';
    res.send(`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;background:#0b0b12;color:#eee;text-align:center;padding-top:60px">
      <h2>✅ ${label} 처리됨</h2><p>${task.title}</p></body>`);
  };
}

export function registerTaskRoutes(app: Express): void {
  // Dev process proposes the next task → notify user, create pending approval.
  app.post('/api/tasks', async (req: Request, res: Response) => {
    const { title, detail } = req.body ?? {};
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'title (string) required' });
      return;
    }
    const task = approvals.create(title, detail);
    const enriched = withUrls(task);
    events.emit('task:proposed', enriched);
    try {
      await notifier.proposeTask(task);
    } catch (err) {
      console.error('notify failed', err);
    }
    res.json(enriched);
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

  app.get('/api/tasks/:id/approve', decideViaLink('approved'));
  app.get('/api/tasks/:id/decline', decideViaLink('declined'));

  // Dev loop marks an approved task as carried out (so it isn't picked up again).
  app.post('/api/tasks/:id/done', (req: Request, res: Response) => {
    const task = approvals.markExecuted(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    events.emit('task:decided', task);
    res.json(task);
  });
}
