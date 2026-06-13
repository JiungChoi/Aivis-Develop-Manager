import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CiStatus, PullRequest } from '../types.js';

const run = promisify(execFile);

interface RawCheck {
  status?: string; // QUEUED | IN_PROGRESS | COMPLETED
  conclusion?: string; // SUCCESS | FAILURE | CANCELLED | ...
}
interface RawPr {
  number: number;
  title: string;
  headRefName: string;
  statusCheckRollup?: RawCheck[];
}

/** Collapse a PR's individual checks into one CI status. */
function rollup(checks: RawCheck[] | undefined): CiStatus {
  if (!checks || checks.length === 0) return 'none';
  let pending = false;
  for (const c of checks) {
    const conclusion = (c.conclusion ?? '').toUpperCase();
    if (c.status && c.status.toUpperCase() !== 'COMPLETED') pending = true;
    else if (conclusion && conclusion !== 'SUCCESS' && conclusion !== 'NEUTRAL' && conclusion !== 'SKIPPED') {
      return 'failing';
    }
  }
  return pending ? 'pending' : 'passing';
}

/** Worst-of rollup across open PRs for a repo-level signal. */
function repoCi(prs: PullRequest[]): CiStatus {
  if (prs.length === 0) return 'none';
  const order: CiStatus[] = ['failing', 'pending', 'passing'];
  for (const status of order) if (prs.some((p) => p.ci === status)) return status;
  return 'unknown';
}

/**
 * Open PRs + CI rollup via the gh CLI. Degrades to an empty/unknown result when
 * gh is missing or unauthenticated, so the dashboard never breaks.
 */
export async function collectGithub(slug: string): Promise<{ openPRs: PullRequest[]; ci: CiStatus }> {
  try {
    const { stdout } = await run(
      'gh',
      ['pr', 'list', '--repo', slug, '--state', 'open', '--limit', '20',
        '--json', 'number,title,headRefName,statusCheckRollup'],
      { timeout: 8000 },
    );
    const raw = JSON.parse(stdout) as RawPr[];
    const openPRs: PullRequest[] = raw.map((p) => ({
      number: p.number,
      title: p.title,
      head: p.headRefName,
      ci: rollup(p.statusCheckRollup),
    }));
    return { openPRs, ci: repoCi(openPRs) };
  } catch {
    return { openPRs: [], ci: 'unknown' };
  }
}
