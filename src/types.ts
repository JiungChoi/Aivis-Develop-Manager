// Shared types for the status board. Seed data lives in board.ts; live data
// is gathered by collectors/ and merged into the /api/board response.

export type ItemStatus = 'done' | 'waiting' | 'blocked' | 'cancelled' | 'progress';

export interface BoardItem {
  title: string;
  status: ItemStatus;
  note?: string;
}

export interface BoardSection {
  id: string;
  title: string;
  items: BoardItem[];
}

export interface ProjectStatus {
  name: string;
  repo: string;
  summary: string;
  items: BoardItem[];
}

export interface ActivityEntry {
  date: string;
  text: string;
}

// ── Live data derived from git/gh (collectors/) ──────────────────

export interface CommitInfo {
  sha: string;
  subject: string;
  date: string; // committer date, ISO 8601
}

export type CiStatus = 'passing' | 'failing' | 'pending' | 'none' | 'unknown';

export interface PullRequest {
  number: number;
  title: string;
  head: string; // head branch
  ci: CiStatus;
}

export interface RepoStatus {
  name: string;
  slug: string; // owner/name
  currentBranch: string;
  featureBranches: string[];
  recentCommits: CommitInfo[];
  /** Commits on develop not yet on main (unreleased work). */
  developAheadOfMain: number;
  openPRs: PullRequest[];
  ci: CiStatus; // repo-level rollup across open PRs
}

/** Aggregate stats derived from the approval ledger. */
export interface Stats {
  throughput7d: number[]; // executed tasks per day, oldest → newest (length 7)
  approvedTotal: number;
  declinedTotal: number;
  avgLeadTimeSec: number; // mean approve → execute duration
  successRate: number; // executed / approved, 0..1
}

/** Freshness of a data collector, surfaced so the UI can degrade gracefully. */
export interface SourceHealth {
  status: 'ok' | 'stale' | 'error';
  at: string; // ISO of last successful (or attempted) collection
  error?: string;
}
