#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT=8000
FRONTEND_PORT=5173
HOST_ADDRESS="127.0.0.1"
NO_INSTALL=0

usage() {
  cat <<EOF
Usage: ./start-new.sh [--backend-port PORT] [--frontend-port PORT] [--host HOST] [--no-install]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend-port)
      BACKEND_PORT="${2:-}"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="${2:-}"
      shift 2
      ;;
    --host)
      HOST_ADDRESS="${2:-}"
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

if ! [[ "$BACKEND_PORT" =~ ^[0-9]+$ ]] || ! [[ "$FRONTEND_PORT" =~ ^[0-9]+$ ]]; then
  echo "Ports must be numeric." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/new-frontend"
RUNTIME_DIR="$ROOT/.runtime-new"
LOG_DIR="$RUNTIME_DIR/logs"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR"

port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

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
  local name="$1"
  local pid_file="$2"
  local pid

  if [ ! -f "$pid_file" ]; then
    return
  fi

  pid="$(tr -d '[:space:]' < "$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping previous $name process tree (PID $pid)..."
    stop_process_tree "$pid"
  fi

  rm -f "$pid_file"
}

start_logged_process() {
  local name="$1"
  local working_directory="$2"
  local pid_file="$3"
  local out_log="$4"
  local err_log="$5"
  shift 5

  stop_stale_process "$name" "$pid_file"

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
    ' "$working_directory" "$pid_file" "$out_log" "$err_log" "$@"
  else
    (
      cd "$working_directory"
      nohup "$@" >"$out_log" 2>"$err_log" &
      echo $! >"$pid_file"
      disown "$!" 2>/dev/null || true
    )
  fi

  echo "$name started with PID $(cat "$pid_file")."
}

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Backend directory not found: $BACKEND_DIR" >&2
  exit 1
fi

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "New frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

stop_stale_process "Backend" "$RUNTIME_DIR/backend.pid"
stop_stale_process "New frontend" "$RUNTIME_DIR/new-frontend.pid"

if port_in_use "$BACKEND_PORT"; then
  echo "Port $BACKEND_PORT is already in use. Run ./stop-new.sh or choose another backend port." >&2
  exit 1
fi

if port_in_use "$FRONTEND_PORT"; then
  echo "Port $FRONTEND_PORT is already in use. Run ./stop-new.sh or choose another frontend port." >&2
  exit 1
fi

PYTHON="$BACKEND_DIR/.venv/bin/python"
if [ ! -x "$PYTHON" ]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON="$(command -v python3)"
  elif command -v python >/dev/null 2>&1; then
    PYTHON="$(command -v python)"
  else
    echo "Python not found. Install Python or create backend/.venv first." >&2
    exit 1
  fi
fi

if [ "$NO_INSTALL" -eq 0 ] && [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "Installing new frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
fi

start_logged_process \
  "Backend" \
  "$BACKEND_DIR" \
  "$RUNTIME_DIR/backend.pid" \
  "$LOG_DIR/backend.out.log" \
  "$LOG_DIR/backend.err.log" \
  "$PYTHON" -m uvicorn app.main:app --host "$HOST_ADDRESS" --port "$BACKEND_PORT" --reload

start_logged_process \
  "New frontend" \
  "$FRONTEND_DIR" \
  "$RUNTIME_DIR/new-frontend.pid" \
  "$LOG_DIR/new-frontend.out.log" \
  "$LOG_DIR/new-frontend.err.log" \
  npm run dev -- --host "$HOST_ADDRESS" --port "$FRONTEND_PORT"

echo
echo "New project stack started."
echo "Frontend: http://$HOST_ADDRESS:$FRONTEND_PORT"
echo "Backend:  http://$HOST_ADDRESS:$BACKEND_PORT"
echo "Logs:     $LOG_DIR"
