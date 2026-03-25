"""Exportação compacta para backup (sem credenciais em código — SMTP só via env)."""
from __future__ import annotations

import gzip
import json
import os
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

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


def build_snapshot_dict(db: Session) -> dict[str, Any]:
    users = _safe_scalars(db, select(User).order_by(User.id))
    projects = _safe_scalars(db, select(Project).order_by(Project.id))
    stages = _safe_scalars(db, select(Stage).order_by(Stage.id))
    entries = _safe_scalars(db, select(DailyEntry).order_by(DailyEntry.id))
    fin = _safe_scalars(db, select(FinancialProductionEntry).order_by(FinancialProductionEntry.id))
    fteams = _safe_scalars(db, select(FinancialTeam).order_by(FinancialTeam.id))
    fplans = _safe_scalars(db, select(FinancialDailyPlan).order_by(FinancialDailyPlan.id))
    fprod = _safe_scalars(db, select(FinancialDailyProduction).order_by(FinancialDailyProduction.id))
    fobra = _safe_scalars(db, select(FinancialObraPlanDaily).order_by(FinancialObraPlanDaily.id))

    return {
        "export_version": 1,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "password_hash": u.password_hash,
                "is_master": u.is_master,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "obra_total_value_brl": p.obra_total_value_brl,
            }
            for p in projects
        ],
        "stages": [
            {
                "id": s.id,
                "project_id": s.project_id,
                "name": s.name,
                "weight": s.weight,
                "total_quantity": s.total_quantity,
                "unit": s.unit,
                "sort_order": s.sort_order,
            }
            for s in stages
        ],
        "daily_entries": [
            {
                "id": e.id,
                "stage_id": e.stage_id,
                "day": e.day.isoformat(),
                "planned_optimistic": e.planned_optimistic,
                "planned_pessimistic": e.planned_pessimistic,
                "executed": e.executed,
                "execution_note": e.execution_note,
            }
            for e in entries
        ],
        "financial_production_entries": [
            {
                "id": x.id,
                "project_id": x.project_id,
                "exec_date": x.exec_date.isoformat(),
                "team_type": x.team_type,
                "segment": x.segment,
                "uen": x.uen,
                "obra_code": x.obra_code,
                "labor_code": x.labor_code,
                "description": x.description,
                "quantity": x.quantity,
                "ups": x.ups,
                "ups_brl": x.ups_brl,
                "value_brl": x.value_brl,
                "ep_note": x.ep_note,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in fin
        ],
        "financial_teams": [
            {
                "id": x.id,
                "project_id": x.project_id,
                "name": x.name,
                "team_type": x.team_type,
                "uen": x.uen,
                "encarregado": x.encarregado,
                "default_daily_target_brl": x.default_daily_target_brl,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in fteams
        ],
        "financial_daily_plans": [
            {
                "id": x.id,
                "project_id": x.project_id,
                "day": x.day.isoformat(),
                "team_id": x.team_id,
                "daily_target_brl": x.daily_target_brl,
                "daily_planning_brl": getattr(x, "daily_planning_brl", 0.0) or 0.0,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in fplans
        ],
        "financial_daily_production": [
            {
                "id": x.id,
                "project_id": x.project_id,
                "day": x.day.isoformat(),
                "team_id": x.team_id,
                "produced_value_brl": x.produced_value_brl,
                "observation": x.observation,
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in fprod
        ],
        "financial_obra_plan_daily": [
            {
                "id": x.id,
                "project_id": x.project_id,
                "day": x.day.isoformat(),
                "planned_increment_brl": x.planned_increment_brl,
                "planned_pessimistic_brl": getattr(x, "planned_pessimistic_brl", None),
                "created_at": x.created_at.isoformat() if x.created_at else None,
            }
            for x in fobra
        ],
    }


def _safe_scalars(db: Session, stmt):
    try:
        return db.scalars(stmt).all()
    except OperationalError as exc:
        if "no such table" in str(exc).lower():
            return []
        raise


def snapshot_gzip_bytes(db: Session) -> tuple[bytes, str]:
    data = build_snapshot_dict(db)
    raw = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
    gz = gzip.compress(raw, compresslevel=9)
    fname = f"obra-backup-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}Z.json.gz"
    return gz, fname


def send_backup_via_smtp(db: Session) -> tuple[bool, str]:
    host = os.getenv("BACKUP_SMTP_HOST", "smtp.gmail.com").strip()
    port = int(os.getenv("BACKUP_SMTP_PORT", "587") or "587")
    user = os.getenv("BACKUP_SMTP_USER", "").strip()
    password = os.getenv("BACKUP_SMTP_PASSWORD", "").strip()
    mail_from = os.getenv("BACKUP_EMAIL_FROM", user).strip()
    mail_to = os.getenv("BACKUP_EMAIL_TO", "").strip()

    if not user or not password or not mail_to:
        return False, (
            "Backup por e-mail não configurado: defina BACKUP_SMTP_USER, BACKUP_SMTP_PASSWORD e "
            "BACKUP_EMAIL_TO nas variáveis de ambiente (use senha de app do Google, nunca a senha da conta no código)."
        )

    body, fname = snapshot_gzip_bytes(db)
    msg = EmailMessage()
    msg["Subject"] = f"[Obra] Backup automático {fname}"
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg.set_content(
        "Backup compactado (JSON gzip) em anexo.\n"
        "Contém usuários (hashes de senha), projetos, etapas, lançamentos e avanço produtivo/financeiro.\n"
        "Guarde o arquivo em local seguro."
    )
    msg.add_attachment(body, maintype="application", subtype="gzip", filename=fname)

    try:
        with smtplib.SMTP(host, port, timeout=60) as smtp:
            smtp.starttls()
            smtp.login(user, password)
            smtp.send_message(msg)
    except OSError as e:
        return False, f"Falha SMTP: {e}"

    return True, f"Backup enviado para {mail_to}"
