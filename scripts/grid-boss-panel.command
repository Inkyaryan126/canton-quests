#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${GRID_BOSS_PANEL_PORT:-3000}"
URL="http://127.0.0.1:${PORT}/admin/grid-builder"
cd "$REPO"

if [[ ! -d node_modules ]]; then
  echo "Boss Panel needs this repo's dependencies installed first."
  echo "Run: npm install"
  read -r "?Press Return to close."
  exit 1
fi

panel_ready() {
  curl -fsS --max-time 60 "$URL" 2>/dev/null | grep -Eq 'Opening the Empire Panel|THE GRID / EMPIRE PANEL'
}

if ! panel_ready; then
  if curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    echo "Port $PORT is in use, but it is not serving The Grid Boss Panel."
    echo "Close that server or launch with: GRID_BOSS_PANEL_PORT=3100 $0"
    read -r "?Press Return to close."
    exit 1
  fi

  STATE_DIR="$(git rev-parse --git-common-dir)/grid-agent-control/builder-os"
  mkdir -p "$STATE_DIR"
  nohup npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$STATE_DIR/dev-server.log" 2>&1 &
  for _ in {1..30}; do
    curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1 && break
    sleep 1
  done
fi

panel_ready || {
  echo "Boss Panel could not start. Check .git/grid-agent-control/builder-os/dev-server.log"
  read -r "?Press Return to close."
  exit 1
}

open "$URL"
