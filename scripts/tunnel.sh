#!/usr/bin/env bash
# Expose the manager publicly so Kakao approval links work from the phone.
# Quick tunnel = random URL per run; print it and remind to set PUBLIC_URL.
set -euo pipefail

if ! command -v cloudflared >/dev/null; then
  echo "cloudflared not installed — run: brew install cloudflared"
  exit 1
fi

echo "Starting quick tunnel to http://localhost:4500 ..."
echo "→ 발급된 https URL을 .env의 PUBLIC_URL에 넣고 매니저를 재시작하세요."
exec cloudflared tunnel --url http://localhost:4500
