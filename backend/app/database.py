import os
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

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


def init_db():
    from app import models  # noqa: F401 — registra tabelas

    Base.metadata.create_all(bind=engine)
    migrate_schema()
