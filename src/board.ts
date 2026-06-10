// Seed content for the status dashboard (newsletter). In-memory for now;
// could be backed by a DB or generated from real project state later.

export type ItemStatus = 'done' | 'waiting' | 'blocked' | 'cancelled' | 'progress';

export interface BoardItem {
  title: string;
  status: ItemStatus;
  note?: string;
}

export interface BoardSection {
  id: string;
  title: string;
  items: BoardItem[];
}

export interface ProjectStatus {
  name: string;
  repo: string;
  summary: string;
  items: BoardItem[];
}

export interface ActivityEntry {
  date: string;
  text: string;
}

export const credentials: BoardSection = {
  id: 'credentials',
  title: '자격증명 · 입력 현황',
  items: [
    { title: 'Aivis-Develop-Manager 원격 레포', status: 'done', note: '생성 + main/develop push 완료' },
    { title: 'GitHub 레포 자동생성 권한', status: 'cancelled', note: '미부여 — 사용자가 직접 생성·전달' },
    { title: '텔레그램 봇', status: 'cancelled', note: '미사용 — 승인은 카카오톡으로' },
    { title: '카카오톡 승인 (PlayMCP)', status: 'waiting', note: 'PlayMCP 인증 필요(브라우저 OAuth)' },
    { title: 'PR 생성 권한 (gh/토큰)', status: 'waiting', note: 'feature→develop은 PR. 현재 브랜치만 push' },
    { title: '공개 URL (ngrok 등)', status: 'waiting', note: '폰에서 대시보드/승인 접근 시' },
  ],
};

export const projects: ProjectStatus[] = [
  {
    name: 'AIVIS',
    repo: 'JiungChoi/Aivis',
    summary: '개인 AI 비서 (Electron/React + .NET). 출시 목표 앱.',
    items: [
      { title: '타임라인 24h 스크롤 버그 수정', status: 'done' },
      { title: '토스트 알림 시스템 + 일정 액션 연결', status: 'done' },
      { title: '겹치는 일정 나란히 배치', status: 'done' },
      { title: '대화 API Minimal API 일원화 (B2) + 런타임 검증', status: 'done' },
      { title: 'App 라우팅 맵 테이블화 (A6)', status: 'progress', note: 'PR 대기' },
      { title: '대시보드 분해 1303→372줄', status: 'done' },
    ],
  },
  {
    name: 'AIVIS Develop Manager',
    repo: 'JiungChoi/Aivis-Develop-Manager',
    summary: '자율 개발 승인·알림 매니저. 카카오톡(PlayMCP)으로 진행/중단 승인.',
    items: [
      { title: '스캐폴드 + 개발계획 문서', status: 'done' },
      { title: 'GitHub Actions CI + docker-compose', status: 'progress', note: 'PR 대기' },
      { title: '웹 대시보드(뉴스레터)', status: 'progress', note: '구축 중' },
      { title: '카카오 PlayMCP 승인 연동', status: 'waiting', note: 'PlayMCP 인증 후' },
    ],
  },
];

export const activity: ActivityEntry[] = [
  { date: '2026-06-10', text: 'AiAgent 고아 폴더 삭제, 매니저 레포 push, 웹 대시보드 착수' },
  { date: '2026-06-10', text: 'AIVIS 백엔드 B2(대화 API 일원화) 컨테이너 재빌드 후 런타임 검증 통과' },
  { date: '2026-06-10', text: 'AIVIS 토스트/겹침 일정/타임라인 스크롤 수정 develop 머지' },
];
