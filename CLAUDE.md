# AIVIS Manager — 개발 가이드

AIVIS 자율 개발용 **승인·알림 매니저**. AIVIS 본체와 별도 레포·별도 컨테이너.

## Git-Flow (⚠️ 무조건 준수)
- `main`(프로덕션, 직접커밋 금지) / `develop`(통합, 직접작업 금지) / `feature/*`
- feature → `git merge --no-ff` → develop → push → 브랜치 삭제
- 비밀키(`.env`, 봇 토큰, 카카오 access token) 커밋 금지
- 머지 전 `npm run build`(tsc) 통과
- Conventional Commits (`feat/fix/refactor/chore/docs`)

## 스택
Node 20 + TypeScript + Express (런타임 의존성 최소). 메신저는 `Notifier` 인터페이스로 추상화(telegram/kakao).

## 기본 규칙
- 한국어 대화, 코드 주석 영어
- 비밀은 환경변수로만
