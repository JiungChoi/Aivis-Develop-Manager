import { PUBLIC_URL } from './config.js';
import type { Task } from './approvals.js';

export interface Notifier {
  /** Notify the user about a proposed task and how to approve/decline. */
  proposeTask(task: Task): Promise<void>;
  /** Plain informational message. */
  info(text: string): Promise<void>;
}

// 카카오 발송은 Claude(헤드리스 개발 루프)가 PlayMCP "나에게 보내기" 도구로 처리한다.
// Node 매니저는 작업 원장(ledger) + SSE(공룡 펫) + 콘솔 로그 역할만 한다. (REST 미사용)
class ConsoleNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    console.log(`[task ${task.id}] 제안: ${task.title} — 승인: ${PUBLIC_URL}/api/tasks/${task.id}/approve`);
  }
  async info(text: string): Promise<void> {
    console.log(`[info] ${text}`);
  }
}

export const notifier: Notifier = new ConsoleNotifier();
