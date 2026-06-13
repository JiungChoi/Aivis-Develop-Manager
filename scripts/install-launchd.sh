#!/usr/bin/env bash
# Install (or reinstall) the always-on dev-loop scheduler (launchd KeepAlive).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$ROOT/scripts/com.aivis.dev-loop.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.aivis.dev-loop.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
sed -e "s|__ROOT__|$ROOT|g" -e "s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "installed: $PLIST_DST (상시 데몬, log: ~/Library/Logs/aivis-dev-loop.log)"
echo "status:    launchctl list | grep aivis"
echo "disable:   launchctl unload $PLIST_DST"
