#!/usr/bin/env bash
# Install (or reinstall) the hourly dev-loop launchd agent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$ROOT/scripts/com.aivis.dev-loop.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.aivis.dev-loop.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed -e "s|__ROOT__|$ROOT|g" -e "s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "installed: $PLIST_DST (every 3600s, log: ~/Library/Logs/aivis-dev-loop.log)"
echo "disable:   launchctl unload $PLIST_DST"
