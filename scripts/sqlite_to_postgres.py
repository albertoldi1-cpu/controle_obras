#!/usr/bin/env python3
"""
Copia dados de backend/data.db (SQLite) para PostgreSQL.

Uso:
  export DATABASE_URL="postgresql+psycopg2://user:pass@host:5432/dbname"
  python3 scripts/sqlite_to_postgres.py

Requer: pip install sqlalchemy psycopg2-binary
"""
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, insert, text

ROOT = Path(__file__).resolve().parent.parent
SQLITE_PATH = ROOT / "backend" / "data.db"
PG_URL = os.environ.get("DATABASE_URL", "").strip()
if not PG_URL or "postgresql" not in PG_URL:
    print("Defina DATABASE_URL com PostgreSQL, ex.: postgresql+psycopg2://...")
    sys.exit(1)

if not SQLITE_PATH.is_file():
    print(f"SQLite não encontrado: {SQLITE_PATH}")
    sys.exit(1)

sys.path.insert(0, str(ROOT / "backend"))
os.environ.pop("DATABASE_URL", None)

from app import models  # noqa: E402, F401
from app.database import Base  # noqa: E402

sqlite_eng = create_engine(f"sqlite:///{SQLITE_PATH}", connect_args={"check_same_thread": False})
pg_eng = create_engine(PG_URL, pool_pre_ping=True)

Base.metadata.create_all(bind=pg_eng)

order = [
    models.User,
    models.Project,
    models.Stage,
    models.DailyEntry,
    models.FinancialProductionEntry,
    models.FinancialTeam,
    models.FinancialDailyPlan,
    models.FinancialDailyProduction,
]

with pg_eng.begin() as conn:
    conn.execute(
        text(
            "TRUNCATE TABLE financial_daily_production, financial_daily_plans, financial_teams, "
            "financial_production_entries, daily_entries, stages, projects, users "
            "RESTART IDENTITY CASCADE"
        )
    )

sqlite_insp = inspect(sqlite_eng)
with sqlite_eng.connect() as sc, pg_eng.begin() as pc:
    for Model in order:
        if not sqlite_insp.has_table(Model.__tablename__):
            print(f"{Model.__tablename__}: tabela ausente no SQLite, pulando")
            continue
        rows = sc.execute(Model.__table__.select()).mappings().all()
        if not rows:
            print(f"{Model.__tablename__}: 0 linhas")
            continue
        for row in rows:
            pc.execute(insert(Model).values(**dict(row)))
        print(f"{Model.__tablename__}: {len(rows)} linhas")

print("Concluído.")
