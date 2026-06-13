# AIVIS Manager

아이비스(AIVIS) 자율 개발을 위한 **승인·알림 매니저 + 주기 개발 루프 + 공룡 데스크톱 펫**.
주기 루프가 백로그에서 다음 작업을 고르면 → **공룡 펫이 말풍선으로 말 걸고 / 카톡으로 알림** →
사용자가 **진행/중단**을 답하면 그 결정을 받아 git-flow로 작업을 수행하거나 멈춘다.

> AIVIS 본체와 **별도 레포 · 별도 컨테이너**로 동작한다.

## 동작 흐름
```
[launchd 매시간] ─ dev-loop.sh ─ claude -p(헤드리스)
    │ REQUESTS.md/백로그 분석 → 다음 작업 1건
    ├ POST /api/tasks ─────────────────┐
    ├ GET /api/tasks/:id (폴링, 최대 30분) │
    └ 승인 시 git-flow로 수행            ▼
                              [Manager :4500]
                                ├ 카카오 "나에게 보내기" + 진행/중단 링크 (cloudflared 터널)
                                └ GET /api/events (SSE) ─→ [공룡 펫(Electron)]
                                                            말풍선 + [진행]/[중단] 버튼
```

## 구성 요소
1. **매니저 서비스** (`src/`) — Express. 승인 원장 + SSE 브로드캐스트 + 카카오 알림.
2. **공룡 펫** (`desktop/`) — Electron 투명·최상위 창. SSE 구독해 제안/진행/완료를 말풍선으로 표시, 버튼으로 즉시 결정.
3. **주기 루프** (`scripts/`) — launchd가 매시간 헤드리스 Claude를 실행, 승인 게이트를 거쳐 작업 수행.

## 셋업
```bash
# 1) 매니저
cp .env.example .env        # (선택) 카카오 토큰 채우기
npm install && npm run build && npm start   # :4500

# 2) 공룡 펫
cd desktop && npm install && npm start

# 3) 주기 개발 루프 (매시간)
bash scripts/install-launchd.sh             # 해제: launchctl unload ~/Library/LaunchAgents/com.aivis.dev-loop.plist

# 4) (선택) 폰에서 카톡 승인 링크 열기
brew install cloudflared && bash scripts/tunnel.sh   # 발급 URL을 .env PUBLIC_URL에 기입
```

## 알림 채널 (NOTIFY_CHANNEL)
- `console` (기본): 로그만.
- `kakao`: 카카오 "나에게 보내기"로 메시지 + 진행/중단 **링크**. 개인 1:1 수신 API가 없어 승인은 링크 클릭.
  - `KAKAO_REST_API_KEY` + `KAKAO_REFRESH_TOKEN`을 채우면 access token 만료(401) 시 자동 갱신.

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/tasks` | `{title, detail}` 작업 제안 → 알림 + SSE, pending 생성 |
| GET | `/api/tasks/:id` | 결정 상태 조회 (pending/approved/declined) — 루프가 폴링 |
| GET | `/api/tasks/:id/approve` \| `/decline` | 링크/펫 승인 → SSE 브로드캐스트 |
| POST | `/api/info` | `{text}` 진행상황 보고 → 알림 + SSE |
| GET | `/api/events` | SSE 스트림(공룡 펫 구독) |
| GET | `/api/board` | 대시보드 집계 데이터 |
| GET | `/health` | 헬스체크(SSE 클라이언트 수 포함) |

## 개발 규칙
git-flow 준수 (main/develop/feature). 자세한 내용은 [CLAUDE.md](CLAUDE.md).
계획 문서: [documents/autonomous-loop-plan.md](documents/autonomous-loop-plan.md).
