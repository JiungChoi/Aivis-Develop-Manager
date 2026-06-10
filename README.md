# AIVIS Manager

아이비스(AIVIS) 자율 개발을 위한 **승인·알림 매니저 서비스**.
개발 프로세스(Claude/CI)가 "다음 작업 진행할까요?"를 제안하면, **폰 메신저로 알림**을 보내고
사용자가 **진행/중단**을 답하면 그 결정을 개발 프로세스가 받아 이어가거나 멈춘다.

> AIVIS 본체와 **별도 레포 · 별도 컨테이너**로 동작한다.

## 동작 흐름
```
[개발 프로세스] --POST /api/tasks--> [Manager] --알림(텔레그램/카카오)--> [내 폰]
                                          ▲                                  |
       GET /api/tasks/:id (폴링) ─────────┘        진행/중단 탭 ─────────────┘
```

## 메신저 채널 (NOTIFY_CHANNEL)
- `telegram` (기본, **양방향**): 봇 인라인 버튼 ✅진행 / ⛔️중단 → 즉시 결정.
- `kakao` (**아웃바운드만**): 카카오 "나에게 보내기"로 메시지 + 진행/중단 **링크**.
  - 카카오는 개인용 1:1 봇 수신 API가 없어, 승인은 링크 클릭(매니저 공개 URL)로 처리.
  - 양방향까지 원하면 카카오 비즈니스 채널+챗봇(심사 필요)을 추후 연동.

## 셋업
```bash
cp .env.example .env   # 토큰 채우기
npm install
npm run build && npm start
```

### 텔레그램(권장) 5분 셋업
1. @BotFather 에서 봇 생성 → `TELEGRAM_BOT_TOKEN`
2. 봇과 대화 시작 후, `https://api.telegram.org/bot<TOKEN>/getUpdates` 로 내 `chat.id` 확인 → `TELEGRAM_CHAT_ID`
3. 공개 URL(예: ngrok/cloudflared)로 webhook 등록:
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<PUBLIC_URL>/webhook/telegram"`

### 카카오(나에게 보내기)
1. Kakao Developers 앱 생성 → REST 키, 카카오 로그인 동의항목 `talk_message`
2. OAuth로 access token 발급 → `KAKAO_ACCESS_TOKEN` (refresh 갱신 필요)

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/tasks` | `{title, detail}` 작업 제안 → 알림 발송, pending 생성 |
| GET | `/api/tasks/:id` | 결정 상태 조회 (pending/approved/declined) — 개발 프로세스가 폴링 |
| GET | `/api/tasks/:id/approve` \| `/decline` | 링크 승인(카카오용) |
| POST | `/webhook/telegram` | 텔레그램 인라인 버튼 콜백 |
| GET | `/health` | 헬스체크 |

## 개발 규칙
git-flow 준수 (main/develop/feature). 자세한 내용은 [CLAUDE.md](CLAUDE.md).
