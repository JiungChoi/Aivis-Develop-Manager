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
const CI_LABEL = { passing: '✓ CI 통과', failing: '✗ CI 실패', pending: '… CI 진행', none: '', unknown: '' };
const ciBadge = (ci) => CI_LABEL[ci] ? `<span class="gb ci-${ci}">${CI_LABEL[ci]}</span>` : '';
// Live git summary for a repo (from /api/board.repos), matched by slug.
const gitStrip = (r) => !r ? '' : `
  <div class="git">
    <div class="gitmeta">
      <span class="gb">⎇ ${esc(r.currentBranch)}</span>
      ${r.developAheadOfMain ? `<span class="gb warn">develop +${r.developAheadOfMain} 미배포</span>` : ''}
      ${r.featureBranches.length ? `<span class="gb">feature ${r.featureBranches.length}개</span>` : ''}
      ${ciBadge(r.ci)}
    </div>
    ${(r.openPRs && r.openPRs.length) ? `<ul class="prs">
      ${r.openPRs.map((p) =>
        `<li><span class="prnum">#${p.number}</span> ${esc(p.title)} ${ciBadge(p.ci)}</li>`).join('')}
    </ul>` : ''}
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

// Pipeline stage derived from a task's decision/executed flags.
const STAGE = {
  pending:   { key: 'pending',   label: '승인대기', badge: 'waiting' },
  running:   { key: 'running',   label: '승인됨',   badge: 'progress' },
  completed: { key: 'completed', label: '완료',     badge: 'done' },
  declined:  { key: 'declined',  label: '중단',     badge: 'cancelled' },
};
const stageOf = (t) =>
  t.executed ? STAGE.completed
  : t.decision === 'approved' ? STAGE.running
  : t.decision === 'declined' ? STAGE.declined
  : STAGE.pending;

const fmtDur = (sec) => {
  if (!sec || sec < 0) return '';
  if (sec < 60) return `${Math.round(sec)}초`;
  if (sec < 3600) return `${Math.round(sec / 60)}분`;
  return `${(sec / 3600).toFixed(1)}시간`;
};
// 승인→실행완료 리드타임 (둘 다 있을 때만).
const leadTime = (t) => (t.decidedAt && t.executedAt)
  ? fmtDur((new Date(t.executedAt) - new Date(t.decidedAt)) / 1000) : '';

// Use a same-origin relative path so approve works whether the dashboard is
// opened on localhost or via the public tunnel. Token stays in the query string.
const relUrl = (u) => { try { const x = new URL(u); return x.pathname + x.search; } catch { return u; } };
// Inline 진행/중단 buttons, only while the task is still pending.
const approveButtons = (t) => t.decision !== 'pending' ? '' : `
  <div class="acts">
    <button class="btn ok" data-url="${esc(relUrl(t.approveUrl))}">▶ 진행</button>
    <button class="btn no" data-url="${esc(relUrl(t.declineUrl))}">■ 중단</button>
  </div>`;

// Dependency-free sparkline (SVG polyline) for a small int series.
const sparkline = (data) => {
  if (!data || data.length < 2) return '';
  const w = 260, h = 44, max = Math.max(1, ...data), n = data.length;
  const pts = data.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
};
function statsCard() {
  const s = BOARD.stats;
  if (!s) return '';
  const total = s.throughput7d.reduce((a, b) => a + b, 0);
  return `
    <div class="card statcard">
      <div class="sc-head">
        <div><div class="name">최근 7일 처리량</div>
          <div class="note">평균 리드타임 ${esc(fmtDur(s.avgLeadTimeSec) || '—')} · 승인후 성공률 ${Math.round(s.successRate * 100)}%</div></div>
        <div class="bign">${total}</div>
      </div>
      ${sparkline(s.throughput7d)}
    </div>`;
}

// Live loop status pin (state + countdown to next cycle).
function loopPin() {
  const l = BOARD.loop;
  if (!l) return '';
  const running = l.state === 'running';
  return `
    <div class="card looppin">
      <div class="lp-head">
        <span class="lp-state ${running ? 'run' : 'idle'}">${running ? '● 사이클 실행 중' : '● 대기 중'}</span>
        <span class="lp-int">${Math.round(l.intervalSec / 60)}분 주기</span>
      </div>
      <div class="lp-count" id="loopCountdown">—</div>
    </div>`;
}
function updateLoopCountdown() {
  const el = document.getElementById('loopCountdown');
  if (!el || !BOARD || !BOARD.loop) return;
  const l = BOARD.loop;
  if (l.state === 'running') { el.textContent = '작업 선정·제안 중…'; return; }
  if (!l.nextCycleAt) { el.textContent = '대기 중'; return; }
  const sec = Math.round((new Date(l.nextCycleAt) - Date.now()) / 1000);
  if (sec <= 0) { el.textContent = '곧 다음 사이클…'; return; }
  el.textContent = `다음 사이클까지 ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

const views = {
  mission() {
    const allItems = [...BOARD.credentials.items, ...BOARD.projects.flatMap((p) => p.items)];
    const count = (s) => allItems.filter((i) => i.status === s).length;
    const pendingApprovals = BOARD.approvals.filter((a) => a.decision === 'pending');
    const decide = pendingApprovals.map((t) => `
      <div class="row">
        <div class="body"><div class="name">${esc(t.title)}</div>${t.detail ? `<div class="note">${esc(t.detail)}</div>` : ''}</div>
        ${badge('waiting')}
      </div>
      ${approveButtons(t)}`).join('');
    return `
      <p class="lead">자율 개발이 백그라운드로 돌며 작업을 제안합니다. 지금 상태와 내가 결정할 일을 한눈에.</p>
      ${loopPin()}
      <div class="tiles">
        <div class="tile"><div class="n">${count('done')}</div><div class="l">완료</div></div>
        <div class="tile"><div class="n">${count('progress')}</div><div class="l">진행중</div></div>
        <div class="tile"><div class="n">${count('waiting')}</div><div class="l">대기</div></div>
        <div class="tile"><div class="n">${pendingApprovals.length}</div><div class="l">승인 대기</div></div>
      </div>
      ${statsCard()}
      <h2 class="section">⚠ 지금 내가 결정할 것</h2>
      <div class="card">${decide || '<div class="empty">결정 대기 중인 승인이 없습니다 🎉</div>'}</div>
      <h2 class="section">최근 진행</h2>
      <ul class="timeline">
        ${BOARD.activity.slice(0, 3).map((a) => `<li><div class="d">${esc(a.date)}</div><div class="t">${esc(a.text)}</div></li>`).join('')}
      </ul>`;
  },
  pipeline() {
    const items = BOARD.approvals;
    const n = (key) => items.filter((t) => stageOf(t).key === key).length;
    const counters = `
      <div class="stages">
        <div class="stage"><div class="n">${n('pending')}</div><div class="l">승인대기</div></div>
        <div class="stage"><div class="n">${n('running')}</div><div class="l">승인됨</div></div>
        <div class="stage"><div class="n">${n('completed')}</div><div class="l">완료</div></div>
        <div class="stage"><div class="n">${n('declined')}</div><div class="l">중단</div></div>
      </div>`;
    if (!items.length) {
      return `<h2 class="section">승인 파이프라인</h2>${counters}
        <div class="empty">아직 승인 요청이 없습니다.<br/>자율 개발이 다음 작업을 제안하면 카카오톡으로 알림이 옵니다.</div>`;
    }
    // newest first
    const sorted = [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `<h2 class="section">승인 파이프라인</h2>${counters}` + sorted.map((t) => {
      const s = stageOf(t);
      const lt = leadTime(t);
      const steps = [
        t.createdAt && `제안 ${relTime(t.createdAt)}`,
        t.decidedAt && `${t.decision === 'approved' ? '승인' : '중단'} ${relTime(t.decidedAt)}`,
        t.executedAt && `실행완료 ${relTime(t.executedAt)}`,
      ].filter(Boolean).join(' · ');
      return `
      <div class="card">
        <div class="row">
          <div class="body">
            <div class="name">${esc(t.title)}</div>
            ${t.detail ? `<div class="note">${esc(t.detail)}</div>` : ''}
            <div class="note">${esc(steps)}${lt ? ` · 리드타임 ${esc(lt)}` : ''}</div>
          </div>
          ${badge(s.badge)}
        </div>
        ${approveButtons(t)}
      </div>`;
    }).join('');
  },
  dev() {
    const bySlug = Object.fromEntries((BOARD.repos || []).map((r) => [r.slug, r]));
    return `<h2 class="section">AIVIS 개발현황</h2>` + BOARD.projects.map((p) => `
      <div class="card">
        <div class="ttl">${esc(p.name)} <span class="repo">${esc(p.repo)}</span></div>
        <div class="sum">${esc(p.summary)}</div>
        ${gitStrip(bySlug[p.repo])}
        <div style="margin-top:10px">${p.items.map(itemRow).join('')}</div>
      </div>`).join('');
  },
  timeline() {
    return `<h2 class="section">타임라인</h2>
      <ul class="timeline">
        ${BOARD.activity.map((a) => `<li><div class="d">${esc(a.date)}</div><div class="t">${esc(a.text)}</div></li>`).join('')}
      </ul>`;
  },
  actions() {
    // Waiting/blocked first — those are the things I actually need to act on.
    const order = { waiting: 0, blocked: 1, progress: 2, done: 3, cancelled: 4 };
    const sorted = [...BOARD.credentials.items].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    return `
      <h2 class="section">${esc(BOARD.credentials.title)}</h2>
      <div class="card">${sorted.map(itemRow).join('')}</div>`;
  },
};

function setActive(tab) {
  document.querySelectorAll('#tabs a').forEach((a) => {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// Footer note: warn when a data source is stale/errored so numbers aren't trusted blindly.
function updateSrcNote() {
  const el = document.getElementById('srcNote');
  if (!el || !BOARD) return;
  const src = BOARD.sources || {};
  const bad = Object.entries(src).filter(([, v]) => v && v.status !== 'ok').map(([k]) => k);
  el.textContent = bad.length ? `일부 데이터 지연: ${bad.join(', ')}` : '실시간 데이터 동기화 중';
}

function render() {
  const tab = (location.hash.replace('#/', '') || 'mission');
  const view = views[tab] || views.mission;
  setActive(views[tab] ? tab : 'mission');
  document.getElementById('view').innerHTML = view();
}

let sseLive = false;

function genLine() {
  if (!BOARD) return '—';
  const t = new Date(BOARD.generatedAt).toLocaleString('ko-KR');
  const live = sseLive
    ? '<span class="live on">● LIVE</span>'
    : '<span class="live off">○ 폴링</span>';
  return `${esc(t)} · ${live}`;
}
function updateGenLine() {
  const el = document.getElementById('genDate');
  if (el) el.innerHTML = genLine();
}

async function load() {
  const res = await fetch('/api/board');
  BOARD = await res.json();
  updateGenLine();
  updateSrcNote();
  render();
}

// Subscribe to the manager's SSE stream so the board updates the instant the
// loop proposes/decides/reports. Polling stays on as a backup if SSE drops.
function connectSSE() {
  try {
    const es = new EventSource('/api/events');
    es.onopen = () => { sseLive = true; updateGenLine(); };
    es.onerror = () => { sseLive = false; updateGenLine(); }; // EventSource auto-reconnects
    ['task:proposed', 'task:decided', 'info', 'loop'].forEach((type) =>
      es.addEventListener(type, () => { load().catch(() => {}); }));
  } catch {
    sseLive = false;
  }
}

async function boot() {
  try {
    await load();
  } catch {
    document.getElementById('view').innerHTML = `<div class="empty">데이터를 불러오지 못했습니다.</div>`;
    return;
  }
  connectSSE();
  // Delegated handler for inline 진행/중단 buttons (token-bearing URL in data-url).
  document.getElementById('view').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-url]');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '처리 중…';
    fetch(btn.dataset.url).then(() => load()).catch(() => load());
  });
  // Backup refresh in case SSE is unavailable; SSE keeps it instant otherwise.
  setInterval(() => { load().catch(() => {}); }, 30000);
  // Tick the loop countdown once a second (cheap; only touches one element).
  setInterval(updateLoopCountdown, 1000);
}

window.addEventListener('hashchange', render);
boot();
