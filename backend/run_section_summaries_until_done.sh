#!/usr/bin/env bash
set -u

LOG="section_summaries_run.log"

count_remaining() {
  python3 - <<'PY'
import json
from pathlib import Path

p = Path("app/assets/datasets_final/documents_and_sections.json")
data = json.loads(p.read_text())
sections = [
    s
    for d in data
    for s in d.get("sections", [])
    if isinstance(s, dict)
]
eligible = [
    s
    for s in sections
    if isinstance(s.get("text"), str)
    and s.get("text").strip()
    and s.get("section_id") is not None
]
done = sum(
    isinstance(s.get("section_summary"), str)
    and bool(s.get("section_summary").strip())
    for s in eligible
)
print(f"total={len(eligible)} done={done} remaining={len(eligible) - done}")
PY
}

while true; do
  STATUS="$(count_remaining)"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ${STATUS}"
  REMAINING="$(printf "%s\n" "$STATUS" | sed -E 's/.*remaining=([0-9]+).*/\1/')"

  if [ "$REMAINING" = "0" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Complete."
    exit 0
  fi

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting summarizer; log=${LOG}"
  PYTHONUNBUFFERED=1 uv run python app/prepare/add_section_summaries.py \
    --model gpt-5-mini \
    --batch-size 20 \
    --max-concurrent-batches 2 >> "$LOG" 2>&1
  EXIT_CODE=$?
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Summarizer exited with code ${EXIT_CODE}"
  sleep 30
done
