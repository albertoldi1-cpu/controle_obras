#!/usr/bin/env bash
# Execute na raiz do projeto: bash scripts/init-git.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -d .git ]]; then
  echo "Git já inicializado (.git existe)."
  git status -sb
  exit 0
fi
git init
git branch -M main
git add -A
git status
git commit -m "Initial commit: Controle de Obras de Grande Porte (FastAPI + React + SQLite)"
echo ""
echo "Pronto. Para enviar ao GitHub/GitLab:"
echo "  git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git"
echo "  git push -u origin main"
