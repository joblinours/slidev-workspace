#!/bin/bash
# Git pull cron — runs every 30 seconds inside the container.
# Env vars expected: SLIDES_EFFECTIVE_DIR, WORKSPACE, BASE_URL, SLIDES_TITLE

CLI="node /app/packages/slidev-workspace/dist/cli.js"
SLIDES_DIR="${SLIDES_EFFECTIVE_DIR:-/workspace/slides}"
WORKSPACE="${WORKSPACE:-/workspace}"

echo "[cron] Git pull loop started (every 30s)"

while true; do
  sleep 30

  BEFORE=$(git -C "${SLIDES_DIR}" rev-parse HEAD 2>/dev/null || echo "unknown")
  git -C "${SLIDES_DIR}" pull --quiet 2>&1 | head -3
  AFTER=$(git -C "${SLIDES_DIR}" rev-parse HEAD 2>/dev/null || echo "unknown")

  if [ "${BEFORE}" = "${AFTER}" ] || [ "${BEFORE}" = "unknown" ]; then
    continue
  fi

  echo "[cron] Changes detected (${BEFORE:0:7} → ${AFTER:0:7}), rebuilding..."

  # Identify which slide directories changed
  CHANGED_SLIDES=$(git -C "${SLIDES_DIR}" diff --name-only "${BEFORE}" "${AFTER}" 2>/dev/null \
    | grep "slides\.md" \
    | xargs -I{} dirname {} \
    | sort -u)

  # Rebuild changed slides individually
  if [ -n "${CHANGED_SLIDES}" ]; then
    while IFS= read -r slide_rel; do
      # Extract slide name relative to the slides root
      slide_name="${slide_rel%/}"
      echo "[cron] Rebuilding: ${slide_name}"
      SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build "${slide_name}" 2>&1 | tail -5
      SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} export "${slide_name}" 2>&1 | tail -5 || true
    done <<< "${CHANGED_SLIDES}"
  fi

  # Rebuild the workspace UI to update metadata (tags, search index, etc.)
  echo "[cron] Updating workspace UI..."
  SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build 2>&1 | tail -3

  echo "[cron] Rebuild complete."
done
