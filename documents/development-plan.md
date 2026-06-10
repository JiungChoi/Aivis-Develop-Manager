# AIVIS Manager — 개발 계획

> 작성: 2026-06-10 · 표준 규칙(개발 전 계획 수립)에 따른 프로젝트 개발계획.

## 1. 목적
AIVIS 자율 개발을 **사람 개입 없이도 안전하게** 진행하기 위한 승인·알림 중계 서비스.
개발 프로세스(Claude/CI)가 다음 작업을 제안하면 → 폰 메신저로 알림 → 사용자가 **진행/중단** →
그 결정을 개발 프로세스가 받아 이어가거나 멈춘다. AIVIS 본체와 **별도 레포·별도 컨테이너**.

## 2. 아키텍처
```
[개발 프로세스] --POST /api/tasks--> [Manager(Express)] --Notifier--> [텔레그램/카카오] --> [폰]
        ▲                                   │  approve/decline                      │
        └──── GET /api/tasks/:id (폴링) ─────┴───────────────────────────────────────┘
```
- **Notifier 추상화**: `telegram`(양방향, 인라인버튼+webhook) / `kakao`(나에게 보내기=아웃바운드, 승인은 링크).
- **승인 스토어**: 현재 인메모리 → (로드맵) SQLite 영속화.
- 런타임 의존성 최소(Express만), Node20+TS, Docker 단일 컨테이너.

## 3. 현재 상태 (v0.1 — 스캐폴드 완료)
- ✅ `POST /api/tasks`, `GET /api/tasks/:id`, 링크/웹훅 승인, `/health`
- ✅ Telegram/Kakao Notifier 구현
- ✅ tsc 빌드 + 로컬 스모크 테스트 통과
- ⏳ 원격 레포 생성·push, 봇 토큰/카카오 토큰, 공개 URL, AIVIS 개발 루프와 연동

## 4. 로드맵
### Phase 1 — MVP 연동 (목표: 실제 카톡/텔레그램으로 승인 받기)
- [ ] GitHub 레포 생성 + push (main/develop)
- [ ] Telegram 봇 토큰/chat_id 설정 + webhook 등록 → 양방향 승인 검증
- [ ] (선택) Kakao 나에게 보내기 토큰 연동(아웃바운드 알림)
- [ ] 공개 URL(ngrok/cloudflared) 또는 배포

### Phase 2 — 개발 루프 통합
- [ ] AIVIS 자율 개발(/loop·스케줄러)이 작업 전 `POST /api/tasks` 호출 + 폴링으로 게이트
- [ ] 작업 메타(브랜치·계획 링크·예상 영향) 알림에 포함
- [ ] 결정 타임아웃 정책(미응답 시 보류/중단)

### Phase 3 — 견고화
- [ ] 승인 이력 영속화(SQLite) + 조회 API
- [ ] 인증(공유 시크릿/HMAC)으로 엔드포인트 보호
- [ ] 카카오 비즈니스 채널 챗봇(양방향) 옵션
- [ ] 알림 종류 확장(빌드 실패/CI 결과/배포)

## 5. 보안·운영
- 비밀(`.env`, 봇 토큰, 카카오 토큰)은 커밋 금지(`.gitignore`), 환경변수만.
- 공개 엔드포인트는 시크릿/HMAC로 보호(Phase 3).
- git-flow 준수, 머지 전 `npm run build` 통과(CLAUDE.md).
