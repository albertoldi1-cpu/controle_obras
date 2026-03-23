import os
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()


def _database_url_from_env() -> str:
    raw = os.getenv("DATABASE_URL", "").strip()
    if not raw:
        return ""
    # Render/Heroku usam postgres://; SQLAlchemy + psycopg2 esperam postgresql+psycopg2://
    if raw.startswith("postgres://"):
        raw = "postgresql+psycopg2://" + raw[len("postgres://") :]
    elif raw.startswith("postgresql://") and not raw.startswith("postgresql+"):
        raw = "postgresql+psycopg2://" + raw[len("postgresql://") :]
    if raw and "postgresql" in raw.lower() and "sslmode=" not in raw.lower():
        if os.getenv("RENDER", "").strip().lower() == "true":
            raw = raw + ("&" if "?" in raw else "?") + "sslmode=require"
    return raw


DATABASE_URL = _database_url_from_env()

if DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
else:
    DB_PATH = Path(__file__).resolve().parent.parent / "data.db"
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record):
        cur = dbapi_connection.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_schema():
    """Adiciona colunas novas em bases já existentes (SQLite ou PostgreSQL)."""
    try:
        insp = inspect(engine)
    except Exception:
        return
    if not insp.has_table("daily_entries"):
        return
    cols = {c["name"] for c in insp.get_columns("daily_entries")}
    if "execution_note" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE daily_entries ADD COLUMN execution_note TEXT"))


def migrate_financial_teams_schema():
    """Adiciona financial_teams e coluna team_id em bases antigas (antes era team_type)."""
    try:
        insp = inspect(engine)
    except Exception:
        return
    if not insp.has_table("financial_daily_plans"):
        return
    cols = {c["name"] for c in insp.get_columns("financial_daily_plans")}
    if "team_id" in cols:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE financial_daily_plans ADD COLUMN team_id INTEGER"))
        conn.execute(text("ALTER TABLE financial_daily_production ADD COLUMN team_id INTEGER"))


def backfill_financial_team_fks():
    """Cria equipes a partir de team_type legado, preenche team_id e remove colunas antigas."""
    from app.models import FinancialTeam

    try:
        insp = inspect(engine)
    except Exception:
        return
    if not insp.has_table("financial_daily_plans"):
        return
    cols = {c["name"] for c in insp.get_columns("financial_daily_plans")}
    if "team_type" not in cols:
        return

    db = SessionLocal()
    try:
        cache: dict[tuple[int, str], int] = {}
        plans = db.execute(
            text("SELECT id, project_id, COALESCE(team_type, '') AS tt FROM financial_daily_plans WHERE team_id IS NULL")
        ).mappings().all()
        for pr in plans:
            pid, tt = int(pr["project_id"]), (pr["tt"] or "").strip()
            key = (pid, tt)
            if key not in cache:
                t = FinancialTeam(
                    project_id=pid,
                    name=tt or "Equipe",
                    team_type=tt,
                    uen="",
                    encarregado="",
                )
                db.add(t)
                db.flush()
                cache[key] = t.id
            db.execute(
                text("UPDATE financial_daily_plans SET team_id = :tid WHERE id = :id"),
                {"tid": cache[key], "id": pr["id"]},
            )
        prods = db.execute(
            text("SELECT id, project_id, COALESCE(team_type, '') AS tt FROM financial_daily_production WHERE team_id IS NULL")
        ).mappings().all()
        for pr in prods:
            pid, tt = int(pr["project_id"]), (pr["tt"] or "").strip()
            key = (pid, tt)
            if key not in cache:
                t = FinancialTeam(
                    project_id=pid,
                    name=tt or "Equipe",
                    team_type=tt,
                    uen="",
                    encarregado="",
                )
                db.add(t)
                db.flush()
                cache[key] = t.id
            db.execute(
                text("UPDATE financial_daily_production SET team_id = :tid WHERE id = :id"),
                {"tid": cache[key], "id": pr["id"]},
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    with engine.begin() as conn:
        for stmt in (
            "ALTER TABLE financial_daily_plans DROP COLUMN team_type",
            "ALTER TABLE financial_daily_plans DROP COLUMN teams_count",
            "ALTER TABLE financial_daily_production DROP COLUMN team_type",
        ):
            try:
                conn.execute(text(stmt))
            except Exception:
                pass


def migrate_projects_obra_total():
    """Adiciona obra_total_value_brl em projetos já existentes."""
    try:
        insp = inspect(engine)
    except Exception:
        return
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "obra_total_value_brl" in cols:
        return
    typ = "REAL" if engine.dialect.name == "sqlite" else "DOUBLE PRECISION"
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE projects ADD COLUMN obra_total_value_brl {typ}"))


def init_db():
    from app import models  # noqa: F401 — registra tabelas

    Base.metadata.create_all(bind=engine)
    migrate_schema()
    migrate_financial_teams_schema()
    backfill_financial_team_fks()
    migrate_projects_obra_total()
