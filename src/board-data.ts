import { join } from 'node:path';
import { homedir } from 'node:os';
import { collectGit } from './collectors/git.js';
import { collectGithub } from './collectors/github.js';
import { parseRequests } from './collectors/requests.js';
import { createCache } from './cache.js';
import type { RepoStatus } from './types.js';

// Local clones the dashboard reports on. Override the root with DEV_DIR if needed.
export const DEV_DIR = process.env.DEV_DIR ?? join(homedir(), 'development');

// Merge local git state with GitHub PR/CI for one repo.
async function collectRepo(name: string, slug: string, path: string): Promise<RepoStatus> {
  const [git, gh] = await Promise.all([collectGit(name, slug, path), collectGithub(slug)]);
  return { ...git, openPRs: gh.openPRs, ci: gh.ci };
}

// Cached repo status (git + GitHub) for both AIVIS repos.
export const reposCache = createCache(
  () =>
    Promise.all([
      collectRepo('AIVIS', 'JiungChoi/Aivis', join(DEV_DIR, 'Aivis')),
      collectRepo('AIVIS Develop Manager', 'JiungChoi/Aivis-Develop-Manager', join(DEV_DIR, 'Aivis-Develop-Manager')),
    ]),
  60_000,
);

// REQUESTS.md is the human-maintained board (one level above the manager repo).
export const requestsCache = createCache(() => parseRequests(join(DEV_DIR, 'REQUESTS.md')), 60_000);
