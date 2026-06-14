#!/usr/bin/env bash
# AIVIS 상시 스케줄러 — 죽지 않고 계속 돈다.
# launchd(KeepAlive)가 이 프로세스를 항상 살려둔다. 종료되면 자동 재기동.
# DEV_LOOP_INTERVAL 초마다 dev-loop.sh(한 사이클)를 실행한다.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then set -a; . "$ROOT/.env"; set +a; fi
INTERVAL="${DEV_LOOP_INTERVAL:-1200}"
MANAGER_URL="${MANAGER_URL:-http://localhost:4500}"

# Report loop phase to the manager so the dashboard shows a live countdown.
heartbeat() {
  curl -sf -X POST "$MANAGER_URL/api/loop/heartbeat" \
    -H 'Content-Type: application/json' -d "{\"phase\":\"$1\"}" >/dev/null 2>&1 || true
}

echo "[scheduler] 기동 $(date '+%F %T') · interval=${INTERVAL}s · pid=$$"

while true; do
  echo "[scheduler] 사이클 시작 $(date '+%F %T')"
  heartbeat start
  bash "$ROOT/scripts/dev-loop.sh" || echo "[scheduler] 사이클 오류(계속 진행)"
  heartbeat end
  echo "[scheduler] ${INTERVAL}s 대기"
  sleep "$INTERVAL"
done
