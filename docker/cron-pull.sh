#!/bin/bash
# Git pull cron — toutes les 30 secondes
# Env vars attendues : SLIDES_EFFECTIVE_DIR, WORKSPACE

CLI="node /app/packages/slidev-workspace/dist/cli.js"
SLIDES_DIR="${SLIDES_EFFECTIVE_DIR:-/workspace/slides}"
WORKSPACE="${WORKSPACE:-/workspace}"

echo "[cron] Boucle git pull démarrée (toutes les 30s)"

while true; do
  sleep 30

  BEFORE=$(git -C "${SLIDES_DIR}" rev-parse HEAD 2>/dev/null || echo "unknown")
  git -C "${SLIDES_DIR}" pull --quiet 2>&1 | head -3
  AFTER=$(git -C "${SLIDES_DIR}" rev-parse HEAD 2>/dev/null || echo "unknown")

  if [ "${BEFORE}" = "${AFTER}" ] || [ "${BEFORE}" = "unknown" ]; then
    continue
  fi

  echo "[cron] Changements détectés (${BEFORE:0:7} → ${AFTER:0:7})"

  # Identifier les dossiers de slides modifiés
  CHANGED=$(git -C "${SLIDES_DIR}" diff --name-only "${BEFORE}" "${AFTER}" 2>/dev/null \
    | grep "slides\.md" \
    | xargs -I{} dirname {} \
    | sort -u)

  if [ -n "${CHANGED}" ]; then
    while IFS= read -r slide_rel; do
      # Nom de la slide = dernier segment du chemin relatif dans le repo
      slide_name=$(basename "${slide_rel}")
      echo "[cron] Rebuild: ${slide_name}"
      SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build "${slide_name}" 2>&1 | tail -5
    done <<< "${CHANGED}"
  fi

  # Rebuild l'UI workspace pour mettre à jour l'index de recherche
  echo "[cron] Mise à jour de l'interface..."
  SLIDEV_WORKSPACE_CWD="${WORKSPACE}" ${CLI} build 2>&1 | tail -3

  echo "[cron] Rebuild terminé."
done
