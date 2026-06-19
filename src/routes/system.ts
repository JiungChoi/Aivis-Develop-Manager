import type { Express, Request, Response } from 'express';
import { events } from '../events.js';
import { loop } from '../loop.js';
import { notifier } from '../notifier.js';

export function registerSystemRoutes(app: Express): void {
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), sseClients: events.clientCount() });
  });

  // Live event stream for desktop clients (dino pet).
  app.get('/api/events', events.handler);

  // Scheduler reports cycle start/end so the dashboard can show a live countdown.
  app.post('/api/loop/heartbeat', (req: Request, res: Response) => {
    const phase = req.body?.phase;
    if (phase !== 'start' && phase !== 'end') {
      res.status(400).json({ error: "phase must be 'start' or 'end'" });
      return;
    }
    loop.onPhase(phase);
    const snap = loop.snapshot();
    events.emit('loop', snap);
    res.json(snap);
  });

  // Dev process reports progress → broadcast to pet + push notification.
  app.post('/api/info', async (req: Request, res: Response) => {
    const { text } = req.body ?? {};
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text (string) required' });
      return;
    }
    events.emit('info', { text, at: new Date().toISOString() });
    try {
      await notifier.info(text);
    } catch (err) {
      console.error('notify failed', err);
    }
    res.json({ ok: true });
  });
}
