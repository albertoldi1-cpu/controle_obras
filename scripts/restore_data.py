#!/usr/bin/env python3
"""Restaura backup completo (substitui dados atuais)."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.backup_restore import restore_snapshot_file  # noqa: E402
from app.database import SessionLocal  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Restaura snapshot completo (usuários + dados) no banco configurado."
    )
    parser.add_argument("snapshot_file", help="Arquivo .json ou .json.gz gerado pelo backup.")
    args = parser.parse_args()

    backup_file = Path(args.snapshot_file).expanduser().resolve()
    if not backup_file.is_file():
        raise SystemExit(f"Arquivo não encontrado: {backup_file}")

    print("ATENÇÃO: esta operação substitui todos os dados atuais do banco.")
    confirm = input("Digite 'RESTAURAR' para continuar: ").strip()
    if confirm != "RESTAURAR":
        print("Operação cancelada.")
        return 1

    db = SessionLocal()
    try:
        restore_snapshot_file(db, backup_file)
    finally:
        db.close()

    print(f"Restauração concluída a partir de: {backup_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
