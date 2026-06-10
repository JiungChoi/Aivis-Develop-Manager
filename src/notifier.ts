import { NOTIFY_CHANNEL, PUBLIC_URL, KAKAO_ACCESS_TOKEN } from './config.js';
import type { Task } from './approvals.js';

export interface Notifier {
  /** Notify the user about a proposed task and how to approve/decline. */
  proposeTask(task: Task): Promise<void>;
  /** Plain informational message. */
  info(text: string): Promise<void>;
}

// ── Console (default) ────────────────────────────────────────────
// 실제 카카오톡 승인은 Claude(자율 개발 루프)가 PlayMCP 로 발송/수신한다.
// Node 서비스는 작업 원장(ledger) + 대시보드 역할이 기본.
class ConsoleNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    console.log(`[task ${task.id}] 제안: ${task.title} — 승인: ${PUBLIC_URL}/api/tasks/${task.id}/approve`);
  }
  async info(text: string): Promise<void> {
    console.log(`[info] ${text}`);
  }
}

// ── Kakao "나에게 보내기" (옵션, 스탠드얼론) ──────────────────────
class KakaoNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    const approve = `${PUBLIC_URL}/api/tasks/${task.id}/approve`;
    const decline = `${PUBLIC_URL}/api/tasks/${task.id}/decline`;
    await this.sendText(`🛠 다음 작업 진행할까요?\n\n${task.title}\n${task.detail ?? ''}\n\n▶ 진행: ${approve}\n■ 중단: ${decline}`, approve);
  }
  async info(text: string): Promise<void> {
    await this.sendText(text, PUBLIC_URL);
  }
  private async sendText(text: string, link: string): Promise<void> {
    const templateObject = { object_type: 'text', text, link: { web_url: link, mobile_web_url: link } };
    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KAKAO_ACCESS_TOKEN}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
    });
    if (!res.ok) console.error('[kakao]', res.status, await res.text());
  }
}

export const notifier: Notifier =
  NOTIFY_CHANNEL === 'kakao' ? new KakaoNotifier() : new ConsoleNotifier();
