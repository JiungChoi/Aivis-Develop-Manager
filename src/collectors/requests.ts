import { readFile } from 'node:fs/promises';
import type { ActivityEntry, BoardItem, ItemStatus } from '../types.js';

export interface RequestsData {
  credentials: BoardItem[];
  activity: ActivityEntry[];
}

// Map the status emoji used in REQUESTS.md tables to a board status.
function mapStatus(cell: string): ItemStatus {
  if (cell.includes('✅') || cell.includes('🟢')) return 'done';
  if (cell.includes('🚫')) return 'cancelled';
  if (cell.includes('❌')) return 'blocked';
  if (cell.includes('🔀') || cell.includes('진행')) return 'progress';
  return 'waiting'; // ⏳ and anything else
}

function splitRow(line: string): string[] {
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

/**
 * Parse the human-maintained REQUESTS.md board into live data:
 * - credentials  ← the "자격증명/입력 … 현황" table
 * - activity     ← the "진행 로그" bullet list (`- YYYY-MM-DD: text`)
 */
export async function parseRequests(mdPath: string): Promise<RequestsData> {
  const text = await readFile(mdPath, 'utf8');
  const lines = text.split('\n');

  const credentials: BoardItem[] = [];
  const activity: ActivityEntry[] = [];
  let section: 'creds' | 'log' | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (line.includes('자격증명') && line.includes('현황')) section = 'creds';
      else if (line.includes('진행 로그')) section = 'log';
      else section = null;
      continue;
    }

    if (section === 'creds' && line.trim().startsWith('|')) {
      const cells = splitRow(line);
      // header: | # | 항목 | 상태 | 비고 |  → skip header & |---| separator
      if (cells.length < 4 || cells[1] === '항목' || cells[0].startsWith('---')) continue;
      const title = cells[1];
      if (!title) continue;
      credentials.push({ title, status: mapStatus(cells[2]), note: cells[3] || undefined });
    } else if (section === 'log') {
      const m = line.match(/^-\s*(\d{4}-\d{2}-\d{2}):\s*(.+)$/);
      if (m) activity.push({ date: m[1], text: m[2].trim() });
    }
  }

  return { credentials, activity };
}
