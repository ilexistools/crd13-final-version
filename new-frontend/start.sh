#!/usr/bin/env bash
set -euo pipefail

HOST="127.0.0.1"
PORT="5173"
NO_INSTALL=0

usage() {
  cat <<EOF
Usage: ./start.sh [--host HOST] [--port PORT] [--no-install]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --no-install)
      NO_INSTALL=1
      shift
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

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Port must be numeric." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_DIR="$ROOT/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_FILE="$RUNTIME_DIR/frontend.pid"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

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

stop_stale_process() {
  local pid

  if [ ! -f "$PID_FILE" ]; then
    return
  fi

  pid="$(tr -d '[:space:]' < "$PID_FILE")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping previous frontend process (PID $pid)..."
    stop_process_tree "$pid"
  fi

  rm -f "$PID_FILE"
}

port_in_use() {
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
}

start_logged_process() {
  if command -v perl >/dev/null 2>&1; then
    LC_ALL=C LANG=C perl -MPOSIX=setsid -e '
      my ($cwd, $pid_file, $out_log, $err_log, @cmd) = @ARGV;
      chdir $cwd or die "chdir $cwd: $!";
      my $pid = fork();
      die "fork: $!" unless defined $pid;
      if ($pid) {
        open my $fh, ">", $pid_file or die "open $pid_file: $!";
        print {$fh} $pid;
        close $fh;
        exit 0;
      }
      setsid() or die "setsid: $!";
      open STDIN, "<", "/dev/null" or die "stdin: $!";
      open STDOUT, ">", $out_log or die "stdout: $!";
      open STDERR, ">", $err_log or die "stderr: $!";
      exec @cmd;
      die "exec @cmd: $!";
    ' "$ROOT" "$PID_FILE" "$LOG_DIR/frontend.out.log" "$LOG_DIR/frontend.err.log" "$@"
  else
    (
      cd "$ROOT"
      nohup "$@" >"$LOG_DIR/frontend.out.log" 2>"$LOG_DIR/frontend.err.log" &
      echo $! >"$PID_FILE"
      disown "$!" 2>/dev/null || true
    )
  fi
}

if [ "$NO_INSTALL" -eq 0 ] && [ ! -d "$ROOT/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT" && npm install)
fi

stop_stale_process

if port_in_use; then
  echo "Port $PORT is already in use. Run ./stop.sh or choose another port." >&2
  exit 1
fi

start_logged_process npm run dev -- --host "$HOST" --port "$PORT"

echo "Frontend started with PID $(cat "$PID_FILE")."
echo "URL:  http://$HOST:$PORT/"
echo "Logs: $LOG_DIR"
