import {
  NOTIFY_CHANNEL,
  PUBLIC_URL,
  KAKAO_ACCESS_TOKEN,
  KAKAO_REST_API_KEY,
  KAKAO_REFRESH_TOKEN,
} from './config.js';
import type { Task } from './approvals.js';

export interface Notifier {
  /** Notify the user about a proposed task and how to approve/decline. */
  proposeTask(task: Task): Promise<void>;
  /** Plain informational message. */
  info(text: string): Promise<void>;
}

// ── Console (default) ────────────────────────────────────────────
class ConsoleNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    console.log(`[task ${task.id}] 제안: ${task.title} — 승인: ${PUBLIC_URL}/api/tasks/${task.id}/approve`);
  }
  async info(text: string): Promise<void> {
    console.log(`[info] ${text}`);
  }
}

// ── Kakao "나에게 보내기" (아웃바운드, 승인은 링크) ───────────────
class KakaoNotifier implements Notifier {
  private accessToken = KAKAO_ACCESS_TOKEN;

  async proposeTask(task: Task): Promise<void> {
    const approve = `${PUBLIC_URL}/api/tasks/${task.id}/approve`;
    const decline = `${PUBLIC_URL}/api/tasks/${task.id}/decline`;
    await this.sendText(
      `🦖 다음 작업 진행할까요?\n\n${task.title}\n${task.detail ?? ''}\n\n▶ 진행: ${approve}\n■ 중단: ${decline}`,
      approve,
    );
  }

  async info(text: string): Promise<void> {
    await this.sendText(text, PUBLIC_URL);
  }

  private async sendText(text: string, link: string, retried = false): Promise<void> {
    const templateObject = { object_type: 'text', text, link: { web_url: link, mobile_web_url: link } };
    const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ template_object: JSON.stringify(templateObject) }),
    });
    if (res.status === 401 && !retried && (await this.refreshToken())) {
      return this.sendText(text, link, true);
    }
    if (!res.ok) console.error('[kakao]', res.status, await res.text());
  }

  /** Refresh the access token via OAuth refresh grant. Returns success. */
  private async refreshToken(): Promise<boolean> {
    if (!KAKAO_REST_API_KEY || !KAKAO_REFRESH_TOKEN) return false;
    const res = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KAKAO_REST_API_KEY,
        refresh_token: KAKAO_REFRESH_TOKEN,
      }),
    });
    if (!res.ok) {
      console.error('[kakao] token refresh failed', res.status, await res.text());
      return false;
    }
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) return false;
    this.accessToken = body.access_token;
    console.log('[kakao] access token refreshed');
    return true;
  }
}

export const notifier: Notifier =
  NOTIFY_CHANNEL === 'kakao' ? new KakaoNotifier() : new ConsoleNotifier();
