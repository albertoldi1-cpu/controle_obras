#!/usr/bin/env python3
"""Gera backup completo (JSON gzip) do banco ativo."""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.backup_restore import save_snapshot_file  # noqa: E402
from app.database import SessionLocal  # noqa: E402


def main() -> int:
    out_dir = ROOT / "backups"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    out_path = out_dir / f"obra-backup-{stamp}.json.gz"

    db = SessionLocal()
    try:
        save_snapshot_file(db, out_path)
    finally:
        db.close()

    print(f"Backup gerado: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
