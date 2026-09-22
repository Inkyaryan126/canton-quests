#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_REPO="${GRID_BOSS_PANEL_REPO:-$(cd "$SCRIPT_DIR/.." && pwd)}"
REQUESTED_PORT="${GRID_BOSS_PANEL_PORT:-3019}"
cd "$SOURCE_REPO"

CANONICAL_BRANCH="$(git for-each-ref --format='%(refname:short)' 'refs/heads/grid-canonical-integration-*' | sort | tail -1)"
if [[ -z "$CANONICAL_BRANCH" ]]; then
  echo "Boss Panel could not find the canonical Grid integration branch."
  read -r "?Press Return to close."
  exit 1
fi

PRIMARY_REPO="$(git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')"
if [[ ! -d "$PRIMARY_REPO/node_modules" ]]; then
  echo "Boss Panel needs this repo's dependencies installed first."
  echo "Run: cd \"$PRIMARY_REPO\" && npm install"
  read -r "?Press Return to close."
  exit 1
fi

git worktree prune
CANONICAL_WORKTREE="$(git worktree list --porcelain | awk -v wanted="refs/heads/$CANONICAL_BRANCH" '
  /^worktree / { current = substr($0, 10) }
  /^branch / && $2 == wanted { print current; exit }
')"
if [[ -z "$CANONICAL_WORKTREE" || ! -d "$CANONICAL_WORKTREE" ]]; then
  CANONICAL_WORKTREE="/private/tmp/$CANONICAL_BRANCH"
  rm -rf "$CANONICAL_WORKTREE" 2>/dev/null || true
  git worktree add "$CANONICAL_WORKTREE" "$CANONICAL_BRANCH"
fi

if [[ ! -e "$CANONICAL_WORKTREE/node_modules" ]]; then
  ln -s "$PRIMARY_REPO/node_modules" "$CANONICAL_WORKTREE/node_modules"
fi
cd "$CANONICAL_WORKTREE"

STATE_DIR="$(git rev-parse --git-common-dir)/grid-agent-control/builder-os"
mkdir -p "$STATE_DIR"

port_in_use() {
  curl -fsS --max-time 1 "http://127.0.0.1:$1/" >/dev/null 2>&1
}

server_cwd() {
  local pid
  pid="$(lsof -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  [[ -n "$pid" ]] || return 1
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1
}

PORT="$REQUESTED_PORT"
if port_in_use "$PORT"; then
  CURRENT_CWD="$(server_cwd "$PORT" || true)"
  if [[ "$CURRENT_CWD" != "$CANONICAL_WORKTREE" ]]; then
    for ((candidate = REQUESTED_PORT + 1; candidate <= REQUESTED_PORT + 10; candidate++)); do
      if ! port_in_use "$candidate"; then
        PORT="$candidate"
        break
      fi
    done
  fi
fi

URL="http://127.0.0.1:${PORT}/admin/grid-builder"
panel_ready() {
  curl -fsS --max-time 2 "$URL" >/dev/null 2>&1
}

if ! panel_ready; then
  nohup npm run dev -- --hostname 127.0.0.1 --port "$PORT" >"$STATE_DIR/dev-server.log" 2>&1 &
  DEV_PID=$!
  echo "$DEV_PID" >"$STATE_DIR/dev-server.pid"
  echo "$CANONICAL_WORKTREE" >"$STATE_DIR/dev-server-worktree.txt"
  for _ in {1..60}; do
    panel_ready && break
    sleep 1
  done
fi

panel_ready || {
  echo "Boss Panel could not start. Check $STATE_DIR/dev-server.log"
  read -r "?Press Return to close."
  exit 1
}

TOKEN="$(node ./node_modules/vite-node/vite-node.mjs scripts/grid-builder-launch-token.ts --cwd "$CANONICAL_WORKTREE")"
if [[ -z "$TOKEN" ]]; then
  echo "Boss Panel could not create its one-time local launch token."
  read -r "?Press Return to close."
  exit 1
fi

open "http://127.0.0.1:${PORT}/api/admin/grid-builder/launch?token=${TOKEN}"
echo "Boss Panel opened from $CANONICAL_BRANCH on port $PORT."
