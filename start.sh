#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=()

cleanup() {
  if ((${#PIDS[@]})); then
    kill "${PIDS[@]}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "$name is ready"
      return 0
    fi
    sleep 1
  done

  echo "Timed out waiting for $name at $url" >&2
  return 1
}

echo "Starting Judge0..."
(cd "$ROOT_DIR/judge0" && docker compose up -d)
wait_for_url "http://127.0.0.1:2358/languages" "Judge0"

if [[ ! -f "$ROOT_DIR/frontend/public/data/manifest.json" ]]; then
  echo "Building frontend data..."
  (cd "$ROOT_DIR/frontend" && npm run build)
fi

echo "Starting backend..."
(cd "$ROOT_DIR/backend" && npm run dev) &
PIDS+=("$!")
wait_for_url "http://127.0.0.1:8000/api/health" "Backend"

echo "Starting frontend..."
(cd "$ROOT_DIR/frontend" && npm run dev) &
PIDS+=("$!")
wait_for_url "http://127.0.0.1:5173/" "Frontend"

echo
echo "EPIJudge is running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Judge0:   http://localhost:2358"
echo
echo "Press Ctrl-C to stop backend and frontend. Judge0 will keep running in Docker."

wait
