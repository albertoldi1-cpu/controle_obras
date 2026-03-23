#!/usr/bin/env bash
# Salva tudo no Git local e mostra como enviar ao GitHub.
# Uso: bash scripts/push-github.sh
# Se o Cursor bloquear o .git, rode este script no Terminal.app (macOS).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .git ]]; then
  echo ">>> Inicializando repositório Git..."
  git init
  git branch -M main
fi

git add -A

if git diff --cached --quiet 2>/dev/null; then
  echo ">>> Nenhuma alteração nova para commitar (working tree limpo ou só ignorados)."
else
  MSG="${1:-Atualização Controle de Obras de Grande Porte}"
  git commit -m "$MSG"
  echo ">>> Commit criado: $MSG"
fi

echo ""
echo "=== Próximos passos no GitHub ==="
echo "1. Acesse https://github.com/new e crie um repositório VAZIO (sem README, sem .gitignore)."
echo "2. No terminal, na pasta do projeto, execute (troque USUARIO e REPO):"
echo ""
echo "   git remote add origin https://github.com/USUARIO/REPO.git"
echo "   git push -u origin main"
echo ""
echo "Se já existir 'origin', use: git remote set-url origin https://github.com/USUARIO/REPO.git"
echo ""
echo "Autenticação: GitHub pede login; use Personal Access Token como senha (Settings → Developer settings → Tokens),"
echo "ou configure SSH: git remote add origin git@github.com:USUARIO/REPO.git"
