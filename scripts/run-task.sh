#!/usr/bin/env bash
# Execute ONE approved task by id (triggered by the manager on approval).
# Shares the dev-loop lock so it never overlaps the hourly scheduler.
set -uo pipefail

TASK_ID="${1:?usage: run-task.sh <task-id>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_DIR="$HOME/development"
MANAGER_URL="${MANAGER_URL:-http://localhost:4500}"
LOCK="/tmp/aivis-dev-loop.lock"

echo "── run-task $TASK_ID $(date '+%F %T') ──"

# Wait briefly for any in-flight cycle, then take the lock.
for _ in 1 2 3 4 5 6; do
  mkdir "$LOCK" 2>/dev/null && break || sleep 10
done
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

cd "$DEV_DIR"
claude -p "승인된 작업 1건을 실행한다. 작업 디렉터리는 ~/development, 매니저는 $MANAGER_URL.
1. \`curl -s $MANAGER_URL/api/tasks/$TASK_ID\` 로 작업 내용을 읽는다. decision이 approved가 아니거나 executed면 아무것도 하지 말고 종료.
2. 해당 레포 develop에서 feature 브랜치를 만들어 작업을 수행한다(git-flow). main/develop 직접 커밋 금지, 비밀키 커밋 금지, 파괴적 명령 금지.
3. 빌드/테스트 통과 확인(npm run build 등). push 가능하면 push, 실패 시 로컬 커밋까지.
4. 끝나면 \`curl -s -X POST $MANAGER_URL/api/tasks/$TASK_ID/done\` 로 완료 표시하고,
   \`curl -s -X POST $MANAGER_URL/api/info -H 'Content-Type: application/json' -d '{\"text\":\"...요약...\"}'\` 로 보고. REQUESTS.md 로그도 갱신.
5. 가능하면 PlayMCP로 카톡에도 완료 한 줄 보고." \
  --permission-mode acceptEdits \
  --allowedTools "Read" "Glob" "Grep" "Edit" "Write" "TodoWrite" \
    "Bash(git:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(node:*)" \
    "Bash(curl:*)" "Bash(dotnet:*)" "Bash(ls:*)" "Bash(cat:*)" \
    "mcp__claude_ai_PlayMCP" \
  --max-turns 120

echo "── run-task done $(date '+%F %T') ──"
