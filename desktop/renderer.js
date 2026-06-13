// Dino pet renderer: pixel art + speech bubble + manager SSE client.
const MANAGER_URL = 'http://localhost:4500';

// ── Pixel dino (16x16, scaled to 96px) ──────────────────────────
const PALETTE = { G: '#4cc24c', D: '#2e8b2e', W: '#ffffff', B: '#111111', P: '#ff9ec4' };

const FRAME_A = [
  '................',
  '......GGGGGG....',
  '.....GGGGGGGG...',
  '.....GWBGGGGG...',
  '.....GGGGGGGG...',
  '.....GGGGDD.....',
  '.....GGGG.......',
  '.GG..GGGGGGG....',
  '.GG.GGGGGGG.....',
  '..GGGGGGGGG.....',
  '...GGPPGGGG.....',
  '....GGGGGG......',
  '.....GGGG.......',
  '.....G..G.......',
  '.....G...G......',
  '....GG...GG.....',
];
// Blink + step frame.
const FRAME_B = FRAME_A.map((row, y) => {
  if (y === 3) return row.replace('WB', 'GG');           // eyes closed
  if (y === 13) return '......G.G.......';               // legs together
  if (y === 14) return '......G..G......';
  if (y === 15) return '.....GG..GG.....';
  return row;
});

const canvas = document.getElementById('dino');
const ctx = canvas.getContext('2d');
const SCALE = 6;

function draw(frame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  frame.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = PALETTE[ch] ?? PALETTE.G;
      ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    });
  });
}

let tick = 0;
setInterval(() => {
  tick++;
  // Mostly frame A; blink/step every few ticks for a lively idle.
  draw(tick % 5 === 0 ? FRAME_B : FRAME_A);
}, 500);
draw(FRAME_A);

// ── Speech bubble ────────────────────────────────────────────────
const bubble = document.getElementById('bubble');
const titleEl = bubble.querySelector('.title');
const detailEl = bubble.querySelector('.detail');
const actionsEl = document.getElementById('actions');
const statusEl = document.getElementById('status');
let hideTimer = null;
let currentTaskId = null;
let currentUrls = null; // { approveUrl, declineUrl } from the manager (token-bearing)

function speak(title, detail, { taskId = null, urls = null, timeout = 20000 } = {}) {
  titleEl.textContent = title;
  detailEl.textContent = detail ?? '';
  currentTaskId = taskId;
  currentUrls = urls;
  actionsEl.classList.toggle('show', !!taskId);
  bubble.classList.add('show');
  clearTimeout(hideTimer);
  if (timeout) hideTimer = setTimeout(() => bubble.classList.remove('show'), timeout);
}

document.getElementById('btn-approve').onclick = () => decide('approve');
document.getElementById('btn-decline').onclick = () => decide('decline');

async function decide(action) {
  if (!currentUrls) return;
  // Use the manager-provided link (carries the approval token).
  const url = action === 'approve' ? currentUrls.approveUrl : currentUrls.declineUrl;
  try {
    await fetch(url);
    speak(action === 'approve' ? '좋아요, 진행할게요! 🦖' : '알겠어요, 중단할게요.', '');
  } catch {
    speak('앗, 매니저 응답이 없어요…', '');
  }
  currentTaskId = null;
  currentUrls = null;
  actionsEl.classList.remove('show');
}

// Click the dino to re-show / hide the last bubble.
canvas.addEventListener('click', () => bubble.classList.toggle('show'));

// ── Manager SSE connection ───────────────────────────────────────
let es = null;

function connect() {
  es = new EventSource(`${MANAGER_URL}/api/events`);

  es.onopen = () => {
    statusEl.textContent = '🟢 매니저 연결됨';
    canvas.classList.remove('offline');
    checkPending();
  };

  es.onerror = () => {
    statusEl.textContent = '⚪ 매니저 대기 중…';
    canvas.classList.add('offline');
    if (es.readyState === EventSource.CLOSED) {
      setTimeout(connect, 5000);
    }
  };

  es.addEventListener('task:proposed', (e) => {
    const task = JSON.parse(e.data);
    speak('🦖 새 작업 제안!', `${task.title}\n${task.detail ?? ''}`, {
      taskId: task.id,
      urls: { approveUrl: task.approveUrl, declineUrl: task.declineUrl },
      timeout: 0,
    });
  });

  es.addEventListener('task:decided', (e) => {
    const task = JSON.parse(e.data);
    if (task.id === currentTaskId) {
      currentTaskId = null;
      actionsEl.classList.remove('show');
    }
    speak(task.decision === 'approved' ? '✅ 진행 결정!' : '⛔ 중단 결정', task.title);
  });

  es.addEventListener('info', (e) => {
    const { text } = JSON.parse(e.data);
    speak('🦖 개발매니저', text, { timeout: 30000 });
  });
}
connect();

// On (re)connect, surface the most recent still-pending proposal.
async function checkPending() {
  try {
    const res = await fetch(`${MANAGER_URL}/api/board`);
    const board = await res.json();
    const pending = (board.approvals ?? []).filter((t) => t.decision === 'pending').pop();
    if (pending) {
      speak('🦖 대기 중인 제안이 있어요!', `${pending.title}\n${pending.detail ?? ''}`, {
        taskId: pending.id,
        urls: { approveUrl: pending.approveUrl, declineUrl: pending.declineUrl },
        timeout: 0,
      });
    }
  } catch { /* manager not up yet */ }
}

// ── Idle chatter ─────────────────────────────────────────────────
const CHATTER = [
  '오늘도 화이팅이에요! 🦖',
  'REQUESTS.md에 할 일 적어두면 제가 챙길게요.',
  '쉬는 것도 개발의 일부예요.',
  '커밋은 작게, 자주!',
  '물 한 잔 마시고 오세요~',
];
setInterval(() => {
  if (!bubble.classList.contains('show') && Math.random() < 0.5) {
    speak('🦖', CHATTER[Math.floor(Math.random() * CHATTER.length)], { timeout: 12000 });
  }
}, 10 * 60 * 1000);
