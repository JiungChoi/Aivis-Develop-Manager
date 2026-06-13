#!/usr/bin/env bash
# AIVIS autonomous dev loop — run by launchd every hour (see install-launchd.sh).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_DIR="$HOME/development"
MANAGER_URL="${MANAGER_URL:-http://localhost:4500}"
LOCK="/tmp/aivis-dev-loop.lock"

echo "── dev-loop $(date '+%F %T') ──"

# Prevent overlapping runs (a cycle may legitimately take a while).
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "another cycle is still running; skip"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

# Make sure the manager is up (start a local instance if not).
if ! curl -sf "$MANAGER_URL/health" >/dev/null; then
  echo "manager not running — starting local instance"
  ENV_FLAG=""
  [ -f "$ROOT/.env" ] && ENV_FLAG="--env-file=$ROOT/.env"
  (cd "$ROOT" && nohup node $ENV_FLAG dist/server.js >>"$HOME/Library/Logs/aivis-manager.log" 2>&1 &)
  sleep 2
  curl -sf "$MANAGER_URL/health" >/dev/null || { echo "manager failed to start"; exit 1; }
fi

# Headless Claude: pick one task, gate on approval, execute via git-flow.
cd "$DEV_DIR"
claude -p "$(cat "$ROOT/scripts/dev-loop-prompt.md")" \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Glob" "Grep" "Edit" "Write" "TodoWrite" \
    "Bash(git:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)" \
    "Bash(curl:*)" "Bash(dotnet:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(sleep:*)" \
  --max-turns 100

echo "── cycle done $(date '+%F %T') ──"
