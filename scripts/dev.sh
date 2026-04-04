#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$ROOT_DIR/web"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
SKIP_INSTALL="${SKIP_INSTALL:-0}"

backend_pid=""
frontend_pid=""

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  for pid in "${frontend_pid:-}" "${backend_pid:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done

  exit "$exit_code"
}

start_backend() {
  printf 'Starting backend on http://%s:%s\n' "$BACKEND_HOST" "$BACKEND_PORT"
  (
    cd "$ROOT_DIR"
    exec uv run uvicorn camviz.api.app:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
  ) &
  backend_pid=$!
}

start_frontend() {
  printf 'Starting frontend on http://%s:%s\n' "$FRONTEND_HOST" "$FRONTEND_PORT"
  (
    cd "$WEB_DIR"
    exec corepack pnpm dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
  ) &
  frontend_pid=$!
}

require_command uv
require_command corepack

trap cleanup EXIT INT TERM

if [[ "$SKIP_INSTALL" != "1" ]]; then
  printf 'Syncing backend dependencies with uv\n'
  (
    cd "$ROOT_DIR"
    uv sync --dev
  )

  printf 'Installing frontend dependencies with pnpm\n'
  (
    cd "$WEB_DIR"
    corepack pnpm install --frozen-lockfile
  )
fi

start_backend
start_frontend

printf 'Dev workspace is starting. Press Ctrl-C to stop both servers.\n'

set +e
wait -n "$backend_pid" "$frontend_pid"
status=$?
set -e

if [[ $status -ne 0 ]]; then
  printf 'One of the dev servers exited with status %s\n' "$status" >&2
fi

exit "$status"
