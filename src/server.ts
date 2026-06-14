import express, { type Request, type Response } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { PORT, PUBLIC_URL, APPROVAL_TOKEN } from './config.js';
import { approvals, type Decision, type Task } from './approvals.js';
import { notifier } from './notifier.js';
import { events } from './events.js';
import { triggerExecution } from './runner.js';
import { credentials, projects, activity } from './board.js';
import { collectGit } from './collectors/git.js';
import { collectGithub } from './collectors/github.js';
import { parseRequests } from './collectors/requests.js';
import { createCache } from './cache.js';
import { loop } from './loop.js';
import { createNewsletter, composeText, type Period } from './newsletter.js';
import type { RepoStatus } from './types.js';

// Local clones the dashboard reports on. Override the root with DEV_DIR if needed.
const DEV_DIR = process.env.DEV_DIR ?? join(homedir(), 'development');

// Merge local git state with GitHub PR/CI for one repo.
async function collectRepo(name: string, slug: string, path: string): Promise<RepoStatus> {
  const [git, gh] = await Promise.all([collectGit(name, slug, path), collectGithub(slug)]);
  return { ...git, openPRs: gh.openPRs, ci: gh.ci };
}

const reposCache = createCache(
  () =>
    Promise.all([
      collectRepo('AIVIS', 'JiungChoi/Aivis', join(DEV_DIR, 'Aivis')),
      collectRepo('AIVIS Develop Manager', 'JiungChoi/Aivis-Develop-Manager', join(DEV_DIR, 'Aivis-Develop-Manager')),
    ]),
  60_000,
);

// REQUESTS.md is the human-maintained board (one level above the manager repo).
const requestsCache = createCache(() => parseRequests(join(DEV_DIR, 'REQUESTS.md')), 60_000);

// Kakao newsletter digest. State file (sent records) lives in the repo's data/ (gitignored).
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const newsletter = createNewsletter(join(repoRoot, 'data', 'newsletter.json'));

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

const asPeriod = (q: unknown): Period => (q === 'weekly' ? 'weekly' : 'daily');

const app = express();
app.use(express.json());

// Allow the desktop pet (file:// origin) to call the API.
app.use((_req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Attach token-bearing approve/decline links so clients never build their own.
function withUrls(task: Task) {
  const q = APPROVAL_TOKEN ? `?token=${encodeURIComponent(APPROVAL_TOKEN)}` : '';
  return {
    ...task,
    approveUrl: `${PUBLIC_URL}/api/tasks/${task.id}/approve${q}`,
    declineUrl: `${PUBLIC_URL}/api/tasks/${task.id}/decline${q}`,
  };
}

// ── Static newsletter dashboard (public/) ───────────────────────
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

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

// ── Kakao newsletter (loop sends; manager composes + dedups) ────
// Current digest text (≤200 chars) for the period.
app.get('/api/newsletter', async (req: Request, res: Response) => {
  const period = asPeriod(req.query.period);
  res.json(newsletter.build(await newsletterText(), period));
});

// Loop asks before sending so we send at most once per window.
app.get('/api/newsletter/should-send', async (req: Request, res: Response) => {
  const period = asPeriod(req.query.period);
  res.json(newsletter.shouldSend(period, await newsletterText()));
});

// Loop reports a successful Kakao send so we don't repeat within the window.
app.post('/api/newsletter/sent', (req: Request, res: Response) => {
  const period = asPeriod(req.body?.period);
  const digest = req.body?.digest;
  if (typeof digest !== 'string') {
    res.status(400).json({ error: 'digest (string) required' });
    return;
  }
  res.json(newsletter.recordSent(period, digest));
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), sseClients: events.clientCount() });
});

// Live event stream for desktop clients (dino pet).
app.get('/api/events', events.handler);

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

app.listen(PORT, () => console.log(`aivis-manager listening on :${PORT} (dashboard: ${'/'})`));
