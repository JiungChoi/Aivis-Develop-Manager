// Runtime config from environment (see .env.example).
export const PORT = Number(process.env.PORT ?? 4500);

// Public base URL of this manager (used in Kakao approve/decline links).
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');

// Which messenger to notify through.
export const NOTIFY_CHANNEL = (process.env.NOTIFY_CHANNEL ?? 'telegram') as 'telegram' | 'kakao';

// Telegram (two-way)
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

// Kakao "메시지 API - 나에게 보내기" (outbound only)
export const KAKAO_ACCESS_TOKEN = process.env.KAKAO_ACCESS_TOKEN ?? '';
