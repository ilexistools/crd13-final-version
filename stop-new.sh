#!/usr/bin/env bash
set -euo pipefail

PORTS=(8000 5173)

usage() {
  cat <<EOF
Usage: ./stop-new.sh [--ports PORT[,PORT...]]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --ports)
      IFS=',' read -r -a PORTS <<< "${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT/.runtime-new"

stop_process_tree() {
  local pid="$1"
  local child

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return
  fi

  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    stop_process_tree "$child"
  done

  kill "$pid" >/dev/null 2>&1 || true
  sleep 1
  kill -9 "$pid" >/dev/null 2>&1 || true
}

stop_from_pid_file() {
  local name="$1"
  local pid_file="$2"
  local pid

  if [ ! -f "$pid_file" ]; then
    echo "$name PID file not found."
    return
  fi

  pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ ]]; then
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "Stopping $name process tree (PID $pid)..."
      stop_process_tree "$pid"
    else
      echo "$name process from PID file is not running."
    fi
  fi

  rm -f "$pid_file"
}

stop_listeners_on_port() {
  local port="$1"
  local pid
  local command_line
  local process_name

  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    echo "Skipping invalid port: $port" >&2
    return
  fi

  for pid in $(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true); do
    command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    if [[ "$command_line" != *"$ROOT"* ]]; then
      process_name="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
      echo "Skipping listener on port $port (PID $pid, ${process_name:-unknown}); it was not started from this project."
      continue
    fi

    process_name="$(ps -p "$pid" -o comm= 2>/dev/null || true)"
    echo "Stopping listener on port $port (PID $pid, ${process_name:-unknown})..."
    stop_process_tree "$pid"
  done
}

stop_from_pid_file "Backend" "$RUNTIME_DIR/backend.pid"
stop_from_pid_file "New frontend" "$RUNTIME_DIR/new-frontend.pid"

for port in "${PORTS[@]}"; do
  stop_listeners_on_port "$port"
done

echo "New project stack stopped."
