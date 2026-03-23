#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Gera backup completo do banco atual.
/usr/bin/env python3 scripts/backup_data.py

# Retenção simples: mantém arquivos de backup dos últimos 30 dias.
if [ -d "backups" ]; then
  /usr/bin/find "backups" -type f -name "obra-backup-*.json.gz" -mtime +30 -delete
fi
