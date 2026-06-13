# 자율 개발 루프 + 공룡 데스크톱 펫 + 카카오 원격 승인 — 개발 계획

> 작성: 2026-06-13 · 브랜치: `feature/dev-loop-and-dino` · 표준 규칙(개발 전 계획 수립) 준수.

## 1. 배경 / 목표
현재 매니저는 **수동 승인 릴레이**(POST 받은 작업을 알리고 결정을 중계)일 뿐,
- 스스로 백로그를 찾아 도는 **주기 루프가 없고**
- PC에서 사용자에게 **말을 거는 채널이 없으며**
- 카카오 알림은 코드만 있고 **토큰/공개 URL이 미연동**이다.

이번 작업으로 다음 세 가지를 완성한다:
1. **주기 개발 루프** — launchd가 매시간 `claude -p`(헤드리스)를 실행, REQUESTS.md/백로그에서 다음 작업 1건을 골라 매니저에 승인 요청 → 승인 시 그 자리에서 git-flow로 수행.
2. **픽셀 공룡 데스크톱 펫** — Electron 투명·최상위 창. 매니저 SSE를 구독해 제안/진행/완료를 말풍선으로 말 걸고, 말풍선에서 바로 진행/중단 결정 가능.
3. **카카오 원격 승인** — 매니저의 "나에게 보내기" + 진행/중단 링크. cloudflared 터널로 매니저를 외부 노출, 액세스 토큰 자동 갱신(refresh token) 추가.

## 2. 아키텍처
```
[launchd (매 60분)]
   └─ scripts/dev-loop.sh ─ claude -p (헤드리스)
        ├─ REQUESTS.md/백로그 분석 → 다음 작업 선정
        ├─ POST /api/tasks ──────────────┐
        ├─ GET /api/tasks/:id 폴링       │
        └─ 승인 시 git-flow로 작업 수행    ▼
                                  [Manager :4500]
                                    ├─ Notifier(kakao) ─→ 카톡 "나에게 보내기" + 승인 링크
                                    │      (cloudflared 터널로 폰에서 링크 접근)
                                    └─ GET /api/events (SSE) ─→ [공룡 펫(Electron)]
                                                                  말풍선 + 진행/중단 버튼
```

## 3. 작업 항목
### A. 매니저 확장 (src/)
- [ ] `events.ts`: 경량 SSE 브로커(의존성 추가 없음). `GET /api/events`로 구독, `task:proposed / task:decided / info` 이벤트 브로드캐스트.
- [ ] `POST /api/info { text }`: 개발 루프가 진행상황을 보고 → Notifier.info + SSE 송출.
- [ ] 카카오 토큰 자동 갱신: `KAKAO_REST_API_KEY`/`KAKAO_REFRESH_TOKEN` 추가, 401 시 refresh 후 1회 재시도.
- [ ] approvals 결정 시 SSE 송출(링크/펫 어느 쪽에서 결정해도 모두에 반영).

### B. 공룡 데스크톱 펫 (desktop/)
- [ ] Electron 앱(devDependency로만, 매니저 런타임과 분리된 별도 package.json).
- [ ] 투명·프레임리스·최상위·드래그 가능한 창. 픽셀 공룡은 canvas로 직접 렌더(2프레임 idle 애니).
- [ ] SSE 구독(자동 재접속): 제안 도착 → 말풍선 + [진행]/[중단] 버튼(매니저 API 호출), info → 말풍선 표시.
- [ ] 매니저 미접속 시 "매니저가 안 떠있어요" 상태 표시.

### C. 주기 개발 루프 (scripts/)
- [ ] `dev-loop-prompt.md`: 헤드리스 Claude 지시문(작업 1건 선정 → 승인 게이트 → git-flow 수행 → 결과 보고).
- [ ] `dev-loop.sh`: 매니저 health 확인 → `claude -p` 실행(허용 도구 제한) → 로그 적재.
- [ ] `com.aivis.dev-loop.plist` + `install-launchd.sh`: 매 3600초 실행, 로그 `~/Library/Logs/aivis-dev-loop.log`.
- [ ] `tunnel.sh`: cloudflared quick tunnel 기동 + PUBLIC_URL 안내.

### D. 문서/마무리
- [ ] README 갱신(셋업 절차), REQUESTS.md 현황 갱신.
- [ ] `npm run build` 통과, 스모크 테스트(서버 기동 → 제안 → SSE 수신 → 링크 승인).
- [ ] PR 생성(feature → develop). PR 권한 없으면 push 후 REQUESTS.md에 기록.

## 4. 결정 사항 (사용자 확정, 2026-06-13)
- 공룡: **Electron 투명창 데스크톱 펫** (메뉴바 앱·웹 위젯 대신)
- 루프: **launchd + claude 헤드리스** (컨테이너 내장·/loop 대신)
- 카톡: **나에게 보내기 + 승인 링크** (PlayMCP는 보류 유지, 텔레그램 미사용)

## 5. 사용자 액션 필요 (코드만으로 안 되는 것)
| 항목 | 내용 |
|------|------|
| 카카오 토큰 | Kakao Developers 앱의 REST API 키 + `talk_message` 동의 후 access/refresh token을 `.env`에 기입 |
| cloudflared | `brew install cloudflared` (미설치 상태) — 폰에서 승인 링크를 열려면 필요 |
| 헤드리스 권한 | `claude -p`가 무인으로 돌려면 허용 도구 범위 확인(기본값은 제한적 allowlist로 구성) |

## 6. 안전장치
- 루프는 **항상 승인 게이트를 통과해야** 코드를 만진다(미응답 30분 → 작업 포기, 다음 주기로).
- 루프 동시 실행 방지(lockfile). 비밀키는 .env로만, 커밋 금지.
- launchd 해제는 `launchctl unload ~/Library/LaunchAgents/com.aivis.dev-loop.plist` 한 줄.
