#!/bin/bash
set -e

WORKSPACE=/workspace
CLI="node /app/packages/slidev-workspace/dist/cli.js"

# ── 1. Clone the GitHub repo ────────────────────────────────────────────────
if [ -z "${GITHUB_REPO}" ]; then
  echo "❌ GITHUB_REPO environment variable is required"
  exit 1
fi

if [ -z "${GITHUB_PAT}" ]; then
  SLIDES_REPO_URL="https://github.com/${GITHUB_REPO}"
else
  SLIDES_REPO_URL="https://${GITHUB_PAT}@github.com/${GITHUB_REPO}"
fi

SLIDES_CLONE_DIR="${WORKSPACE}/slides"

if [ -d "${SLIDES_CLONE_DIR}/.git" ]; then
  echo "=== Slides repo already cloned, pulling latest ==="
  git -C "${SLIDES_CLONE_DIR}" pull --quiet
else
  echo "=== Cloning ${GITHUB_REPO} ==="
  git clone "${SLIDES_REPO_URL}" "${SLIDES_CLONE_DIR}"
fi

# Resolve effective slides directory (GITHUB_PATH is optional subfolder)
if [ -n "${GITHUB_PATH}" ]; then
  SLIDES_EFFECTIVE_DIR="${SLIDES_CLONE_DIR}/${GITHUB_PATH}"
else
  SLIDES_EFFECTIVE_DIR="${SLIDES_CLONE_DIR}"
fi

if [ ! -d "${SLIDES_EFFECTIVE_DIR}" ]; then
  echo "❌ Slides directory not found: ${SLIDES_EFFECTIVE_DIR}"
  exit 1
fi

# ── 2. Generate slidev-workspace.yaml from env vars ─────────────────────────
mkdir -p "${WORKSPACE}"

cat > "${WORKSPACE}/slidev-workspace.yaml" <<YAML
slidesDir:
  - "${SLIDES_EFFECTIVE_DIR}"
outputDir: "${WORKSPACE}/dist"
baseUrl: "${BASE_URL:-/}"
hero:
  title: "${SLIDES_TITLE:-Mes Présentations}"
  description: "Browse all available slide decks."
sidebar:
  title: "${SLIDES_TITLE:-Mes Présentations}"
YAML

echo "=== Config generated at ${WORKSPACE}/slidev-workspace.yaml ==="

# ── 3. Install dependencies for each slide ──────────────────────────────────
echo "=== Installing slide dependencies ==="
find "${SLIDES_EFFECTIVE_DIR}" -name "package.json" -not -path "*/node_modules/*" | while read -r pkg; do
  dir=$(dirname "${pkg}")
  echo "  pnpm install in ${dir}"
  pnpm install --dir "${dir}" --no-frozen-lockfile 2>&1 | tail -5
done

# ── 4. Build all presentations ───────────────────────────────────────────────
echo "=== Building all presentations ==="
SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build

# ── 5. Export PDF/PPTX ──────────────────────────────────────────────────────
echo "=== Exporting PDF/PPTX ==="
SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} export || echo "⚠️ Some exports may have failed (non-fatal)"

# ── 6. Configure Nginx ──────────────────────────────────────────────────────
echo "=== Configuring Nginx ==="
export BASE_URL="${BASE_URL:-/}"
envsubst '${BASE_URL}' < /app/docker/nginx.conf.template > /etc/nginx/sites-enabled/slidev-workspace.conf
nginx -t

# ── 7. Start git pull cron in background ────────────────────────────────────
echo "=== Starting git pull cron (every 30s) ==="
SLIDES_EFFECTIVE_DIR="${SLIDES_EFFECTIVE_DIR}" \
WORKSPACE="${WORKSPACE}" \
SLIDES_REPO_URL="${SLIDES_REPO_URL}" \
BASE_URL="${BASE_URL:-/}" \
SLIDES_TITLE="${SLIDES_TITLE:-Mes Présentations}" \
  /app/docker/cron-pull.sh &

# ── 8. Start Nginx ──────────────────────────────────────────────────────────
echo "=== Slidev Workspace is ready on port 8084 ==="
exec nginx -g "daemon off;"
