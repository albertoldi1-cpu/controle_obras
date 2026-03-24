#!/usr/bin/env python3
"""
Copia dados de backend/data.db (SQLite) para PostgreSQL.

Uso (no seu Mac, na raiz do repositório):
  export DATABASE_URL="postgresql://user:pass@HOST:5432/dbname"
  python3 scripts/sqlite_to_postgres.py

Aceita também postgres:// (como no Render). Para Postgres no Render acessado **da internet**,
use a **External Database URL** do painel (host termina em .postgres.render.com) e inclua :5432.

Requer: pip install -r backend/requirements.txt -r backend/requirements-postgres.txt
"""
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, insert, text

ROOT = Path(__file__).resolve().parent.parent
SQLITE_PATH = ROOT / "backend" / "data.db"


def _normalize_postgres_url(raw: str) -> str:
    u = raw.strip()
    if u.startswith("postgres://"):
        u = "postgresql+psycopg2://" + u[len("postgres://") :]
    elif u.startswith("postgresql://") and not u.startswith("postgresql+"):
        u = "postgresql+psycopg2://" + u[len("postgresql://") :]
    if u and "postgresql+psycopg2" in u and "sslmode=" not in u:
        if ".render.com" in u or "render.com" in u:
            u = u + ("&" if "?" in u else "?") + "sslmode=require"
    return u


PG_URL = _normalize_postgres_url(os.environ.get("DATABASE_URL", "").strip())
if not PG_URL or "postgresql+psycopg2" not in PG_URL:
    print("Defina DATABASE_URL com PostgreSQL, ex.: postgresql://user:pass@host:5432/dbname")
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

def _sqlite_colnames(sqlite_insp, tablename: str) -> list[str]:
    if not sqlite_insp.has_table(tablename):
        return []
    return [c["name"] for c in sqlite_insp.get_columns(tablename)]


def _row_for_postgres(Model, row: dict) -> dict:
    """Completa colunas novas no modelo que ainda não existem no SQLite antigo."""
    out = dict(row)
    tname = Model.__tablename__
    extras = {
        ("projects", "obra_total_value_brl"): None,
        ("financial_teams", "default_daily_target_brl"): None,
        ("financial_daily_plans", "daily_planning_brl"): 0.0,
    }
    for col in Model.__table__.columns:
        if col.name in out:
            continue
        key = (tname, col.name)
        if key in extras:
            out[col.name] = extras[key]
        elif col.nullable:
            out[col.name] = None
        elif col.default is not None and getattr(col.default, "arg", None) is not None:
            out[col.name] = col.default.arg
        else:
            out[col.name] = None
    return {c.name: out[c.name] for c in Model.__table__.columns}


sqlite_insp = inspect(sqlite_eng)
with sqlite_eng.connect() as sc, pg_eng.begin() as pc:
    for Model in order:
        cols = _sqlite_colnames(sqlite_insp, Model.__tablename__)
        if not cols:
            print(f"{Model.__tablename__}: tabela ausente no SQLite, pulando")
            continue
        quoted = ", ".join(f'"{c}"' for c in cols)
        rows = sc.execute(text(f'SELECT {quoted} FROM "{Model.__tablename__}"')).mappings().all()
        if not rows:
            print(f"{Model.__tablename__}: 0 linhas")
            continue
        for row in rows:
            pc.execute(insert(Model).values(**_row_for_postgres(Model, dict(row))))
        print(f"{Model.__tablename__}: {len(rows)} linhas")

print("Concluído.")
