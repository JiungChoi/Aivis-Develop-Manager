import type { Express, Request, Response } from 'express';
import { approvals } from '../approvals.js';
import { credentials, projects, activity } from '../board.js';
import { reposCache, requestsCache } from '../board-data.js';
import { loop } from '../loop.js';
import { withUrls } from '../links.js';

export function registerBoardRoutes(app: Express): void {
  // Aggregated board data for the dashboard.
  app.get('/api/board', async (_req: Request, res: Response) => {
    const [repos, reqs] = await Promise.all([reposCache.get(), requestsCache.get()]);
    // Prefer live REQUESTS.md data; fall back to the seed in board.ts on failure.
    const liveCredentials = reqs.value?.credentials.length ? { ...credentials, items: reqs.value.credentials } : credentials;
    const liveActivity = reqs.value?.activity.length ? reqs.value.activity : activity;
    res.json({
      credentials: liveCredentials,
      projects,
      activity: liveActivity,
      approvals: approvals.list().map(withUrls),
      repos: repos.value ?? [],
      loop: loop.snapshot(),
      stats: approvals.stats(),
      sources: {
        git: { status: repos.status, at: repos.at, error: repos.error },
        requests: { status: reqs.status, at: reqs.at, error: reqs.error },
      },
      generatedAt: new Date().toISOString(),
    });
  });
}
