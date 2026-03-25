"""Backup e restauração completos (usuários + dados de obra/financeiro)."""
from __future__ import annotations

import gzip
import json
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.backup_export import build_snapshot_dict
from app.models import (
    DailyEntry,
    FinancialDailyPlan,
    FinancialDailyProduction,
    FinancialObraPlanDaily,
    FinancialProductionEntry,
    FinancialTeam,
    Project,
    Stage,
    User,
)


def save_snapshot_file(db: Session, output_path: Path) -> Path:
    data = build_snapshot_dict(db)
    raw = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    payload = gzip.compress(raw, compresslevel=9)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(payload)
    return output_path


def load_snapshot_file(snapshot_path: Path) -> dict[str, Any]:
    blob = snapshot_path.read_bytes()
    try:
        raw = gzip.decompress(blob)
    except OSError:
        raw = blob
    data = json.loads(raw.decode("utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Snapshot inválido: raiz JSON deve ser objeto.")
    return data


def restore_snapshot_dict(db: Session, data: dict[str, Any]) -> None:
    # Ordem de limpeza respeita FKs (filhos -> pais)
    for model in (
        FinancialDailyProduction,
        FinancialObraPlanDaily,
        FinancialDailyPlan,
        FinancialProductionEntry,
        DailyEntry,
        FinancialTeam,
        Stage,
        Project,
        User,
    ):
        db.query(model).delete(synchronize_session=False)

    for row in data.get("users", []):
        db.add(
            User(
                id=row["id"],
                username=row["username"],
                password_hash=row["password_hash"],
                is_master=bool(row.get("is_master", False)),
                is_active=bool(row.get("is_active", True)),
            )
        )

    for row in data.get("projects", []):
        db.add(
            Project(
                id=row["id"],
                name=row["name"],
                description=row.get("description"),
                obra_total_value_brl=row.get("obra_total_value_brl"),
            )
        )

    for row in data.get("stages", []):
        db.add(
            Stage(
                id=row["id"],
                project_id=row["project_id"],
                name=row["name"],
                weight=row["weight"],
                total_quantity=row["total_quantity"],
                unit=row.get("unit"),
                sort_order=row.get("sort_order", 0),
            )
        )

    for row in data.get("daily_entries", []):
        db.add(
            DailyEntry(
                id=row["id"],
                stage_id=row["stage_id"],
                day=row["day"],
                planned_optimistic=row.get("planned_optimistic", 0.0),
                planned_pessimistic=row.get("planned_pessimistic", 0.0),
                executed=row.get("executed", 0.0),
                execution_note=row.get("execution_note"),
            )
        )

    for row in data.get("financial_production_entries", []):
        db.add(
            FinancialProductionEntry(
                id=row["id"],
                project_id=row["project_id"],
                exec_date=row["exec_date"],
                team_type=row.get("team_type", ""),
                segment=row.get("segment", ""),
                uen=row.get("uen", ""),
                obra_code=row.get("obra_code", ""),
                labor_code=row.get("labor_code", ""),
                description=row.get("description", ""),
                quantity=row.get("quantity", 0.0),
                ups=row.get("ups", 0.0),
                ups_brl=row.get("ups_brl", 0.0),
                value_brl=row.get("value_brl", 0.0),
                ep_note=row.get("ep_note"),
            )
        )

    for row in data.get("financial_teams", []):
        db.add(
            FinancialTeam(
                id=row["id"],
                project_id=row["project_id"],
                name=row["name"],
                team_type=row.get("team_type", ""),
                uen=row.get("uen", ""),
                encarregado=row.get("encarregado", ""),
                default_daily_target_brl=row.get("default_daily_target_brl"),
            )
        )

    for row in data.get("financial_daily_plans", []):
        db.add(
            FinancialDailyPlan(
                id=row["id"],
                project_id=row["project_id"],
                day=row["day"],
                team_id=row["team_id"],
                daily_target_brl=row.get("daily_target_brl", 0.0),
                daily_planning_brl=row.get("daily_planning_brl", 0.0),
            )
        )

    for row in data.get("financial_daily_production", []):
        db.add(
            FinancialDailyProduction(
                id=row["id"],
                project_id=row["project_id"],
                day=row["day"],
                team_id=row["team_id"],
                produced_value_brl=row.get("produced_value_brl", 0.0),
                observation=row.get("observation"),
            )
        )

    for row in data.get("financial_obra_plan_daily", []):
        db.add(
            FinancialObraPlanDaily(
                id=row["id"],
                project_id=row["project_id"],
                day=row["day"],
                planned_increment_brl=row.get("planned_increment_brl", 0.0),
                planned_pessimistic_brl=row.get("planned_pessimistic_brl"),
            )
        )

    db.flush()
    _sync_pk_sequences_if_postgres(db)
    db.commit()


def restore_snapshot_file(db: Session, snapshot_path: Path) -> None:
    data = load_snapshot_file(snapshot_path)
    restore_snapshot_dict(db, data)


def _sync_pk_sequences_if_postgres(db: Session) -> None:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    table_pk = {
        "users": "id",
        "projects": "id",
        "stages": "id",
        "daily_entries": "id",
        "financial_production_entries": "id",
        "financial_teams": "id",
        "financial_daily_plans": "id",
        "financial_daily_production": "id",
        "financial_obra_plan_daily": "id",
    }
    for table, pk in table_pk.items():
        db.execute(
            text(
                "SELECT setval(pg_get_serial_sequence(:table_name, :pk_name), "
                "COALESCE((SELECT MAX(" + pk + ") FROM " + table + "), 1), true)"
            ),
            {"table_name": table, "pk_name": pk},
        )
