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
  echo "=== Clonage de ${GITHUB_REPO} ==="
  git clone "${SLIDES_REPO_URL}" "${SLIDES_CLONE_DIR}"
fi

# GITHUB_PATH = sous-dossier optionnel dans le repo (parent des présentations)
if [ -n "${GITHUB_PATH}" ]; then
  SLIDES_EFFECTIVE_DIR="${SLIDES_CLONE_DIR}/${GITHUB_PATH}"
else
  SLIDES_EFFECTIVE_DIR="${SLIDES_CLONE_DIR}"
fi

if [ ! -d "${SLIDES_EFFECTIVE_DIR}" ]; then
  echo "❌ Slides directory not found: ${SLIDES_EFFECTIVE_DIR}"
  exit 1
fi

echo "=== Scanning slides in: ${SLIDES_EFFECTIVE_DIR} ==="

# ── 2. Génération de slidev-workspace.yaml ──────────────────────────────────
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

echo "=== Config générée ==="

# ── 3. Installation des dépendances par slide (indépendamment) ───────────────
# Chaque slide utilise sa propre version de Slidev (depuis son pnpm-lock.yaml)
# On N'utilise PAS de workspace pnpm pour éviter les conflits de version
echo "=== Installation des dépendances ==="
find "${SLIDES_EFFECTIVE_DIR}" -name "slides.md" -not -path "*/node_modules/*" | while read -r slides_md; do
  dir=$(dirname "${slides_md}")
  if [ -f "${dir}/package.json" ]; then
    echo "  pnpm install in ${dir}"
    CI=true pnpm install --dir "${dir}" --no-frozen-lockfile 2>&1 | tail -3
  fi
done

# ── 4. Build des présentations ───────────────────────────────────────────────
echo "=== Build de toutes les présentations ==="
SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build

# ── 5. Export PDF/PPTX ──────────────────────────────────────────────────────
echo "=== Export PDF/PPTX ==="
SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} export || echo "⚠️ Certains exports ont échoué (non fatal)"

# ── 6. Configurer Nginx ──────────────────────────────────────────────────────
echo "=== Configuration Nginx ==="
export BASE_URL="${BASE_URL:-/}"
envsubst '${BASE_URL}' < /app/docker/nginx.conf.template > /etc/nginx/sites-enabled/slidev-workspace.conf
nginx -t

# ── 7. Démarrer le cron git pull en arrière-plan ────────────────────────────
echo "=== Démarrage du cron git pull (toutes les 30s) ==="
SLIDES_EFFECTIVE_DIR="${SLIDES_EFFECTIVE_DIR}" \
WORKSPACE="${WORKSPACE}" \
SLIDES_REPO_URL="${SLIDES_REPO_URL}" \
BASE_URL="${BASE_URL:-/}" \
SLIDES_TITLE="${SLIDES_TITLE:-Mes Présentations}" \
  /app/docker/cron-pull.sh &

# ── 8. Démarrer le serveur API (tags) en arrière-plan ──────────────────────
echo "=== Démarrage du serveur API (port 3099) ==="
SLIDES_EFFECTIVE_DIR="${SLIDES_EFFECTIVE_DIR}" \
  node /app/packages/slidev-workspace/dist/api-server.js &

# ── 9. Démarrer Nginx ──────────────────────────────────────────────────────
echo "=== Slidev Workspace prêt sur le port 8084 ==="
exec nginx -g "daemon off;"
