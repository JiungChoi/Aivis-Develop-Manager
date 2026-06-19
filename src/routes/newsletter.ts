import type { Express, Request, Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { approvals } from '../approvals.js';
import { credentials, projects } from '../board.js';
import { reposCache, requestsCache } from '../board-data.js';
import { createNewsletter, composeText, type Period } from '../newsletter.js';

// Newsletter dedup state file lives in the repo's data/ (gitignored).
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const newsletter = createNewsletter(join(repoRoot, 'data', 'newsletter.json'));

const asPeriod = (q: unknown): Period => (q === 'weekly' ? 'weekly' : 'daily');

// Compose the current digest text from live board data.
async function newsletterText(): Promise<string> {
  const [repos, reqs] = await Promise.all([reposCache.get(), requestsCache.get()]);
  const credItems = reqs.value?.credentials.length ? reqs.value.credentials : credentials.items;
  const items = [...credItems, ...projects.flatMap((p) => p.items)];
  const counts = {
    done: items.filter((i) => i.status === 'done').length,
    progress: items.filter((i) => i.status === 'progress').length,
    pendingApprovals: approvals.list().filter((t) => t.decision === 'pending').length,
  };
  return composeText(repos.value ?? [], counts);
}

export function registerNewsletterRoutes(app: Express): void {
  // ── Kakao newsletter (loop sends; manager composes + dedups) ────
  // Current digest text for the period.
  app.get('/api/newsletter', async (req: Request, res: Response) => {
    res.json(newsletter.build(await newsletterText(), asPeriod(req.query.period)));
  });

  // Loop asks before sending so we send at most once per window.
  app.get('/api/newsletter/should-send', async (req: Request, res: Response) => {
    res.json(newsletter.shouldSend(asPeriod(req.query.period), await newsletterText()));
  });

  // Loop reports a successful Kakao send so we don't repeat within the window.
  app.post('/api/newsletter/sent', (req: Request, res: Response) => {
    const digest = req.body?.digest;
    if (typeof digest !== 'string') {
      res.status(400).json({ error: 'digest (string) required' });
      return;
    }
    res.json(newsletter.recordSent(asPeriod(req.body?.period), digest));
  });
}
