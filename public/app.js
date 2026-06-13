const STATUS_LABEL = {
  done: '완료', progress: '진행 중', waiting: '대기',
  blocked: '막힘', cancelled: '미사용',
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const badge = (status) => `<span class="badge b-${status}">${STATUS_LABEL[status] ?? status}</span>`;
const relTime = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
};
// Live git summary for a repo (from /api/board.repos), matched by slug.
const gitStrip = (r) => !r ? '' : `
  <div class="git">
    <div class="gitmeta">
      <span class="gb">⎇ ${esc(r.currentBranch)}</span>
      ${r.developAheadOfMain ? `<span class="gb warn">develop +${r.developAheadOfMain} 미배포</span>` : ''}
      ${r.featureBranches.length ? `<span class="gb">feature ${r.featureBranches.length}개</span>` : ''}
    </div>
    <ul class="commits">
      ${r.recentCommits.slice(0, 4).map((c) =>
        `<li><code>${esc(c.sha)}</code> ${esc(c.subject)} <span class="ago">${esc(relTime(c.date))}</span></li>`).join('')}
    </ul>
  </div>`;
const itemRow = (it) => `
  <div class="row">
    <div class="body">
      <div class="name">${esc(it.title)}</div>
      ${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}
    </div>
    ${badge(it.status)}
  </div>`;

let BOARD = null;

const views = {
  overview() {
    const allItems = [...BOARD.credentials.items, ...BOARD.projects.flatMap((p) => p.items)];
    const count = (s) => allItems.filter((i) => i.status === s).length;
    const pending = BOARD.approvals.filter((a) => a.decision === 'pending').length;
    return `
      <p class="lead">자율 개발이 백그라운드에서 진행 중입니다. 내가 결정하거나 입력해야 할 것과 지금까지의 진행 상황을 한눈에 정리했습니다.</p>
      <div class="tiles">
        <div class="tile"><div class="n">${count('done')}</div><div class="l">완료</div></div>
        <div class="tile"><div class="n">${count('progress')}</div><div class="l">진행중</div></div>
        <div class="tile"><div class="n">${count('waiting')}</div><div class="l">대기</div></div>
        <div class="tile"><div class="n">${pending}</div><div class="l">승인 대기</div></div>
      </div>
      <h2 class="section">지금 내가 결정·입력할 것</h2>
      <div class="card">
        ${BOARD.credentials.items.filter((i) => i.status === 'waiting').map(itemRow).join('') || '<div class="empty">대기 중인 항목이 없습니다 🎉</div>'}
      </div>
      <h2 class="section">최근 진행</h2>
      <ul class="timeline">
        ${BOARD.activity.slice(0, 3).map((a) => `<li><div class="d">${esc(a.date)}</div><div class="t">${esc(a.text)}</div></li>`).join('')}
      </ul>`;
  },
  requests() {
    return `
      <h2 class="section">${esc(BOARD.credentials.title)}</h2>
      <div class="card">${BOARD.credentials.items.map(itemRow).join('')}</div>`;
  },
  projects() {
    const bySlug = Object.fromEntries((BOARD.repos || []).map((r) => [r.slug, r]));
    return `<h2 class="section">프로젝트 현황</h2>` + BOARD.projects.map((p) => `
      <div class="card">
        <div class="ttl">${esc(p.name)} <span class="repo">${esc(p.repo)}</span></div>
        <div class="sum">${esc(p.summary)}</div>
        ${gitStrip(bySlug[p.repo])}
        <div style="margin-top:10px">${p.items.map(itemRow).join('')}</div>
      </div>`).join('');
  },
  activity() {
    return `<h2 class="section">진행 로그</h2>
      <ul class="timeline">
        ${BOARD.activity.map((a) => `<li><div class="d">${esc(a.date)}</div><div class="t">${esc(a.text)}</div></li>`).join('')}
      </ul>`;
  },
  approvals() {
    const items = BOARD.approvals;
    if (!items.length) return `<h2 class="section">승인</h2><div class="empty">대기 중인 승인 요청이 없습니다.<br/>자율 개발이 다음 작업을 제안하면 카카오톡으로 알림이 옵니다.</div>`;
    return `<h2 class="section">승인 요청</h2>` + items.map((t) => `
      <div class="card">
        <div class="row">
          <div class="body"><div class="name">${esc(t.title)}</div>${t.detail ? `<div class="note">${esc(t.detail)}</div>` : ''}</div>
          ${badge(t.decision === 'pending' ? 'waiting' : t.decision === 'approved' ? 'done' : 'cancelled')}
        </div>
      </div>`).join('');
  },
};

function setActive(tab) {
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
}

function render() {
  const tab = (location.hash.replace('#/', '') || 'overview');
  const view = views[tab] || views.overview;
  setActive(views[tab] ? tab : 'overview');
  document.getElementById('view').innerHTML = view();
}

async function load() {
  const res = await fetch('/api/board');
  BOARD = await res.json();
  document.getElementById('genDate').textContent =
    new Date(BOARD.generatedAt).toLocaleString('ko-KR') + ' · 15초마다 자동 새로고침';
  render();
}

async function boot() {
  try {
    await load();
  } catch {
    document.getElementById('view').innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.</div>`;
    return;
  }
  // Keep the board live without a manual refresh.
  setInterval(() => { load().catch(() => {}); }, 15000);
}

window.addEventListener('hashchange', render);
boot();
