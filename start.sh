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

ensure_file_from_example() {
  local dest="$1"
  local example="$2"

  if [[ ! -f "$dest" ]]; then
    cp "$example" "$dest"
    echo "Created ${dest#$ROOT_DIR/} from $(basename "$example")"
  fi
}

ensure_npm_install() {
  local dir="$1"
  local name="$2"

  if [[ ! -d "$dir/node_modules" ]]; then
    echo "Installing $name dependencies..."
    (cd "$dir" && npm install)
  fi
}

echo "Setting up..."
ensure_file_from_example "$ROOT_DIR/backend/.env" "$ROOT_DIR/backend/.env.example"
ensure_file_from_example "$ROOT_DIR/judge0/judge0.conf" "$ROOT_DIR/judge0/judge0.conf.example"
ensure_npm_install "$ROOT_DIR/backend" "backend"
ensure_npm_install "$ROOT_DIR/frontend" "frontend"

echo "Starting Judge0..."
JUDGE0_DIR="$ROOT_DIR/judge0"

(cd "$JUDGE0_DIR" && docker compose up -d)
if ! wait_for_url "http://127.0.0.1:2358/languages" "Judge0" 120; then
  if (cd "$JUDGE0_DIR" && docker compose logs --tail=20 server db 2>&1) | grep -q 'password authentication failed'; then
    echo >&2
    echo "Judge0 cannot connect to Postgres. This usually means the Docker volume" >&2
    echo "was created with a different password than judge0/judge0.conf." >&2
    echo "Reset the local Judge0 database and try again:" >&2
    echo "  cd judge0 && docker compose down -v && docker compose up -d" >&2
  fi
  exit 1
fi

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
