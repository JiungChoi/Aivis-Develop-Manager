// Tracks the autonomous dev loop's heartbeat so the dashboard can show a live
// status pin + countdown to the next cycle. Fed by scheduler.sh via /api/loop/heartbeat.

const INTERVAL_SEC = Number(process.env.DEV_LOOP_INTERVAL ?? 1200);
const APPROVAL_TIMEOUT_SEC = Number(process.env.APPROVAL_TIMEOUT_SEC ?? 86400); // 24h — 천천히 결정해도 됨

export type LoopState = 'idle' | 'running';

export interface LoopSnapshot {
  intervalSec: number;
  approvalTimeoutSec: number;
  state: LoopState;
  lastCycleAt: string | null; // last cycle start
  nextCycleAt: string | null; // estimated next start (idle only)
}

let state: LoopState = 'idle';
let lastCycleAt: string | null = null;
let lastCycleEndAt: string | null = null;

export const loop = {
  onPhase(phase: 'start' | 'end'): void {
    const now = new Date().toISOString();
    if (phase === 'start') {
      state = 'running';
      lastCycleAt = now;
    } else {
      state = 'idle';
      lastCycleEndAt = now;
    }
  },
  snapshot(): LoopSnapshot {
    const base = lastCycleEndAt ?? lastCycleAt;
    const nextCycleAt =
      state === 'idle' && base ? new Date(Date.parse(base) + INTERVAL_SEC * 1000).toISOString() : null;
    return { intervalSec: INTERVAL_SEC, approvalTimeoutSec: APPROVAL_TIMEOUT_SEC, state, lastCycleAt, nextCycleAt };
  },
};
