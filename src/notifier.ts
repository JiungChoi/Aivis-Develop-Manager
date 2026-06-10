import {
  NOTIFY_CHANNEL, PUBLIC_URL,
  TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, KAKAO_ACCESS_TOKEN,
} from './config.js';
import type { Task } from './approvals.js';

export interface Notifier {
  /** Notify the user about a proposed task and how to approve/decline. */
  proposeTask(task: Task): Promise<void>;
  /** Plain informational message. */
  info(text: string): Promise<void>;
}

// ── Telegram (two-way via inline buttons + webhook) ──────────────
class TelegramNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    const text = `🛠 *다음 작업 진행할까요?*\n\n*${task.title}*\n${task.detail ?? ''}\n\n\`#${task.id}\``;
    await this.api('sendMessage', {
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ 진행', callback_data: `approve:${task.id}` },
          { text: '⛔️ 중단', callback_data: `decline:${task.id}` },
        ]],
      },
    });
  }

  async info(text: string): Promise<void> {
    await this.api('sendMessage', { chat_id: TELEGRAM_CHAT_ID, text });
  }

  private async api(method: string, body: unknown): Promise<void> {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('[telegram]', res.status, await res.text());
  }
}

// ── Kakao "나에게 보내기" (outbound only; approve via link) ───────
class KakaoNotifier implements Notifier {
  async proposeTask(task: Task): Promise<void> {
    const approve = `${PUBLIC_URL}/api/tasks/${task.id}/approve`;
    const decline = `${PUBLIC_URL}/api/tasks/${task.id}/decline`;
    const text = `🛠 다음 작업 진행할까요?\n\n${task.title}\n${task.detail ?? ''}\n\n▶ 진행: ${approve}\n■ 중단: ${decline}`;
    await this.sendText(text, approve);
  }

  async info(text: string): Promise<void> {
    await this.sendText(text, PUBLIC_URL);
  }

  private async sendText(text: string, link: string): Promise<void> {
    const templateObject = {
      object_type: 'text',
      text,
      link: { web_url: link, mobile_web_url: link },
    };
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
  NOTIFY_CHANNEL === 'kakao' ? new KakaoNotifier() : new TelegramNotifier();
