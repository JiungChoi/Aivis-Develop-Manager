import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { CommitInfo, RepoStatus } from '../types.js';

const run = promisify(execFile);

// Field separator unlikely to appear in commit subjects.
const SEP = '';

async function git(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', repoPath, ...args], { timeout: 8000 });
  return stdout.trim();
}

/** The slice of RepoStatus that comes from the local git clone. */
export type GitStatus = Omit<RepoStatus, 'openPRs' | 'ci'>;

/** Read live branch/commit state from a local clone via the git CLI (no deps). */
export async function collectGit(name: string, slug: string, repoPath: string): Promise<GitStatus> {
  const [currentBranch, branchesRaw, logRaw, aheadRaw] = await Promise.all([
    git(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(repoPath, ['branch', '--format=%(refname:short)']),
    git(repoPath, ['log', '-8', `--format=%h${SEP}%s${SEP}%cI`]),
    // main..develop may not exist in every repo; treat failure as 0.
    git(repoPath, ['rev-list', '--count', 'main..develop']).catch(() => '0'),
  ]);

  const featureBranches = branchesRaw
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b.startsWith('feature/'));

  const recentCommits: CommitInfo[] = logRaw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, subject, date] = line.split(SEP);
      return { sha, subject, date };
    });

  return {
    name,
    slug,
    currentBranch,
    featureBranches,
    recentCommits,
    developAheadOfMain: Number(aheadRaw) || 0,
  };
}
