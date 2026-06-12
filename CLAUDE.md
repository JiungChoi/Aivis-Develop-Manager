# AIVIS Manager — 개발 가이드

AIVIS 자율 개발용 **승인·알림 매니저**. AIVIS 본체와 별도 레포·별도 컨테이너.

## Git-Flow (⚠️ 무조건 준수)
- `main`(배포, 직접커밋 금지) / `develop`(통합, 직접작업 금지) / `feature/*`
- **feature 완료 → develop 합칠 때는 Pull Request 생성**(로컬 머지 X). GitHub Actions CI가 빌드 검증.
- 비밀키(`.env`, 봇 토큰, 카카오 access token) 커밋 금지
- 머지 전 `npm run build`(tsc) 통과 (CI 자동 검증)
- Conventional Commits (`feat/fix/refactor/chore/docs`)

## 의존성 원칙
- 이 매니저는 **개발 도구**이므로 Kakao **PlayMCP** 등 Claude 측 MCP에 의존해도 됨.
- 반면 **AIVIS 본체는 출시 앱**이라 개발용 MCP 의존 금지 — Kakao가 필요하면 별도 **프로덕션급 백엔드 연동**(Kakao Developers/REST).

## 스택
Node 20 + TypeScript + Express (런타임 의존성 최소). 메신저는 `Notifier` 인터페이스로 추상화(telegram/kakao).

## 기본 규칙
- 한국어 대화, 코드 주석 영어
- 비밀은 환경변수로만
