import { PUBLIC_URL, APPROVAL_TOKEN } from './config.js';
import type { Task } from './approvals.js';

// Attach token-bearing approve/decline links so clients never build their own.
export function withUrls(task: Task) {
  const q = APPROVAL_TOKEN ? `?token=${encodeURIComponent(APPROVAL_TOKEN)}` : '';
  return {
    ...task,
    approveUrl: `${PUBLIC_URL}/api/tasks/${task.id}/approve${q}`,
    declineUrl: `${PUBLIC_URL}/api/tasks/${task.id}/decline${q}`,
  };
}
