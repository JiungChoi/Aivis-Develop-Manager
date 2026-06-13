// Runtime config from environment (see .env.example).
export const PORT = Number(process.env.PORT ?? 4500);

// Public base URL of this manager (used in approval links).
export const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, '');

// How the Node service itself notifies.
//  - 'console' (default): 로그만.
//  - 'kakao': Node 서비스가 카카오 REST '나에게 보내기'로 직접 발송(승인은 링크).
export const NOTIFY_CHANNEL = (process.env.NOTIFY_CHANNEL ?? 'console') as 'console' | 'kakao';

// Kakao "메시지 API - 나에게 보내기" (NOTIFY_CHANNEL=kakao 일 때만 사용)
export const KAKAO_ACCESS_TOKEN = process.env.KAKAO_ACCESS_TOKEN ?? '';
// Optional: enables automatic access-token refresh on 401.
export const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY ?? '';
export const KAKAO_REFRESH_TOKEN = process.env.KAKAO_REFRESH_TOKEN ?? '';
