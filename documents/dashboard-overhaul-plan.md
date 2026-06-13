# 대시보드 고도화 + 카톡 뉴스레터 — 설계/로드맵

> 2026-06-13 설계 논의(프론트/UX·백엔드/데이터 두 관점) 결과를 합친 실행 계획.
> 목표: 대시보드를 **AIVIS 개발 진행현황 중심의 라이브 관제판**으로 고도화하고,
> 현황 요약을 **카카오 뉴스레터로 주기 발송**한다. 의존성 추가 0, 단계별 작은 PR.

## 핵심 원칙
- **사실의 원천을 옮기지 말고 파생한다.** git/gh CLI · `REQUESTS.md` · 승인 원장이 원천이고,
  `board`는 그것들을 모아 캐시할 뿐. 사람이 `board.ts`를 손으로 고치는 일을 없앤다.
- **Node는 카톡을 못 보낸다(불변 제약).** 매니저는 200자 요약을 만들어 두고(`/api/newsletter`),
  발송은 헤드리스 루프 claude가 PlayMCP "나에게 보내기"로 한다. 별도 데몬 0개(20분 루프 재사용).
- **의존성 0 추가.** `git`/`gh` CLI + `node:fs`/`node:child_process`만 사용.
- **하위호환·점진 마이그레이션.** `/api/board` 기존 키는 유지해 `app.js`가 깨지지 않게,
  신규 키/뷰는 뒤 PR에서. 각 PR은 `npm run build`로 독립 검증되는 작은 단위.

## 정보구조(IA) 재편
관제(Mission Control) → 승인 파이프라인 → AIVIS 개발현황 → 타임라인 → 내 액션.
자율 루프와 내가 결정할 일을 앞으로 배치(폰에서 3초 안에 "지금 상태 + 할 일" 파악).

## 데이터 계약 확장 (`/api/board`)
- `repos[]` — 레포별 현재 브랜치 / feature 브랜치 / 최근 커밋 / develop↔main 차이 / 열린 PR / CI
- `loop` — 주기·다음 사이클·상태(idle/proposing/awaiting/executing)·승인 타임아웃
- `stats` — 7일 처리량·승인후 성공률·평균 리드타임
- `sources` — 수집기별 신선도(ok/stale/error)
- 기존 `credentials`/`projects`/`activity`/`approvals`는 유지하되 점차 실데이터 파생으로 교체.

## 단계별 PR 로드맵
| PR | 브랜치 | 범위 |
|----|--------|------|
| 1 | `feature/dash-real-git` | 타입 분리(`types.ts`) + `collectors/git.ts` + TTL/SWR 캐시 + `/api/board.repos`·`sources.git` + 프로젝트 뷰에 실제 커밋/브랜치 노출 |
| 2 | `feature/collector-github` | `gh` CLI로 열린 PR·CI 상태 수집 → `repos[].openPRs/ci` (미인증 시 폴백) |
| 3 | `feature/requests-parser` | `REQUESTS.md` 파싱 → `credentials`·`activity` 실데이터화(하드코딩 제거) |
| 4 | `feature/dash-sse-live` | 대시보드가 기존 SSE(`/api/events`) 구독 → 즉시 갱신, 폴링은 백업으로 강등 |
| 5 | `feature/dash-ia-tabs` | 탭 재편(관제/승인 파이프라인/개발현황/타임라인/내 액션) |
| 6 | `feature/dash-approval-actions` | 승인 카드 인라인 [진행]/[중단] 버튼(`approveUrl`/`declineUrl` fetch) + 리드타임 |
| 7 | `feature/board-loop-state` | `loop` 상태 + scheduler heartbeat + 카운트다운/프로그레스 |
| 8 | `feature/board-stats` | `stats` 집계 + KPI 타일 의미 전환 + 무의존성 SVG 스파크라인 |
| 9 | `feature/newsletter-endpoint` | `/api/newsletter`·`/should-send`·`/sent`(200자·digest 중복방지) + dev-loop 0.5단계 |
| 10 | `feature/dash-polish` | 반응형/접근성/스켈레톤/마이크로 인터랙션, (선택) 승인원장 영속화 |

각 PR은 `develop`에서 `feature/*` 분기 → PR → CI 통과 후 머지. 한 주기에 하나.
