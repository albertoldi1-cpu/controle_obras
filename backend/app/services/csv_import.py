"""Importação em lote via CSV para lançamentos físicos e financeiros."""
from __future__ import annotations

import csv
import io
from datetime import date
from typing import List, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DailyEntry, FinancialDailyPlan, FinancialDailyProduction, FinancialTeam, Project, Stage


def _parse_date(s: str) -> date:
    s = (s or "").strip()
    if not s:
        raise ValueError("data vazia")
    parts = s.replace("/", "-").split("-")
    if len(parts) == 3 and len(parts[0]) == 4:
        y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
    elif len(parts) == 3:
        d, m, y = int(parts[0]), int(parts[1]), int(parts[2])
        if y < 100:
            y += 2000
    else:
        raise ValueError(f"data inválida: {s}")
    return date(y, m, d)


def _float_cell(s: str, default: float = 0.0) -> float:
    t = (s or "").strip().replace(",", ".")
    if not t:
        return default
    return float(t)


def import_entries_planned_csv(db: Session, project_id: int, raw: str) -> Tuple[int, List[str]]:
    """
    Cabeçalho (linha 1): stage_id,day,planned_optimistic,planned_pessimistic
    Dados a partir da linha 2. Dia: AAAA-MM-DD ou DD/MM/AAAA.
    """
    errors: List[str] = []
    stage_ids = set(db.scalars(select(Stage.id).where(Stage.project_id == project_id)).all())
    if not stage_ids:
        return 0, ["Projeto sem etapas cadastradas."]
    reader = csv.reader(io.StringIO(raw.strip()))
    rows = list(reader)
    if not rows:
        return 0, ["Arquivo vazio."]
    n = 0
    for i, row in enumerate(rows[1:], start=2):
        if not row or all(not (c or "").strip() for c in row):
            continue
        try:
            if len(row) < 4:
                raise ValueError("menos de 4 colunas")
            sid = int(str(row[0]).strip())
            if sid not in stage_ids:
                raise ValueError(f"etapa {sid} não pertence ao projeto")
            d = _parse_date(str(row[1]))
            opt = _float_cell(str(row[2]))
            pes = _float_cell(str(row[3]))
            existing = db.scalar(select(DailyEntry).where(DailyEntry.stage_id == sid, DailyEntry.day == d))
            if existing:
                existing.planned_optimistic = opt
                existing.planned_pessimistic = pes
            else:
                db.add(
                    DailyEntry(
                        stage_id=sid,
                        day=d,
                        planned_optimistic=opt,
                        planned_pessimistic=pes,
                        executed=0.0,
                        execution_note=None,
                    )
                )
            n += 1
        except Exception as e:
            errors.append(f"Linha {i}: {e}")
    if n:
        db.commit()
    return n, errors


def import_entries_executed_csv(db: Session, project_id: int, raw: str) -> Tuple[int, List[str]]:
    """
    Cabeçalho: stage_id,day,executed,execution_note
    execution_note opcional (4ª coluna).
    """
    errors: List[str] = []
    stage_ids = set(db.scalars(select(Stage.id).where(Stage.project_id == project_id)).all())
    if not stage_ids:
        return 0, ["Projeto sem etapas cadastradas."]
    reader = csv.reader(io.StringIO(raw.strip()))
    rows = list(reader)
    if not rows:
        return 0, ["Arquivo vazio."]
    n = 0
    for i, row in enumerate(rows[1:], start=2):
        if not row or all(not (c or "").strip() for c in row):
            continue
        try:
            if len(row) < 3:
                raise ValueError("menos de 3 colunas")
            sid = int(str(row[0]).strip())
            if sid not in stage_ids:
                raise ValueError(f"etapa {sid} não pertence ao projeto")
            d = _parse_date(str(row[1]))
            ex = _float_cell(str(row[2]))
            note = (str(row[3]).strip() if len(row) > 3 else "") or None
            existing = db.scalar(select(DailyEntry).where(DailyEntry.stage_id == sid, DailyEntry.day == d))
            if existing:
                existing.executed = ex
                if note is not None:
                    existing.execution_note = note
            else:
                db.add(
                    DailyEntry(
                        stage_id=sid,
                        day=d,
                        planned_optimistic=0.0,
                        planned_pessimistic=0.0,
                        executed=ex,
                        execution_note=note,
                    )
                )
            n += 1
        except Exception as e:
            errors.append(f"Linha {i}: {e}")
    if n:
        db.commit()
    return n, errors


def _team_in_project(db: Session, project_id: int, team_id: int) -> None:
    t = db.get(FinancialTeam, team_id)
    if not t or t.project_id != project_id:
        raise ValueError(f"equipe {team_id} inválida")


def import_financial_plans_csv(db: Session, project_id: int, raw: str) -> Tuple[int, List[str]]:
    """
    Cabeçalho: day,team_id,daily_target_brl,daily_planning_brl
    daily_planning_brl opcional (default 0).
    """
    if not db.get(Project, project_id):
        return 0, ["Projeto não encontrado."]
    errors: List[str] = []
    reader = csv.reader(io.StringIO(raw.strip()))
    rows = list(reader)
    if not rows:
        return 0, ["Arquivo vazio."]
    n = 0
    for i, row in enumerate(rows[1:], start=2):
        if not row or all(not (c or "").strip() for c in row):
            continue
        try:
            if len(row) < 3:
                raise ValueError("menos de 3 colunas")
            d = _parse_date(str(row[0]))
            tid = int(str(row[1]).strip())
            _team_in_project(db, project_id, tid)
            tgt = _float_cell(str(row[2]))
            pln = _float_cell(str(row[3]), 0.0) if len(row) > 3 else 0.0
            existing = db.scalar(
                select(FinancialDailyPlan).where(
                    FinancialDailyPlan.project_id == project_id,
                    FinancialDailyPlan.day == d,
                    FinancialDailyPlan.team_id == tid,
                )
            )
            if existing:
                existing.daily_target_brl = tgt
                existing.daily_planning_brl = pln
            else:
                db.add(
                    FinancialDailyPlan(
                        project_id=project_id,
                        day=d,
                        team_id=tid,
                        daily_target_brl=tgt,
                        daily_planning_brl=pln,
                    )
                )
            n += 1
        except Exception as e:
            errors.append(f"Linha {i}: {e}")
    if n:
        db.commit()
    return n, errors


def import_financial_production_csv(db: Session, project_id: int, raw: str) -> Tuple[int, List[str]]:
    """
    Cabeçalho: day,team_id,produced_value_brl,observation
    observation opcional.
    """
    if not db.get(Project, project_id):
        return 0, ["Projeto não encontrado."]
    errors: List[str] = []
    reader = csv.reader(io.StringIO(raw.strip()))
    rows = list(reader)
    if not rows:
        return 0, ["Arquivo vazio."]
    n = 0
    for i, row in enumerate(rows[1:], start=2):
        if not row or all(not (c or "").strip() for c in row):
            continue
        try:
            if len(row) < 3:
                raise ValueError("menos de 3 colunas")
            d = _parse_date(str(row[0]))
            tid = int(str(row[1]).strip())
            _team_in_project(db, project_id, tid)
            val = _float_cell(str(row[2]))
            obs = (str(row[3]).strip() if len(row) > 3 else "") or None
            existing = db.scalar(
                select(FinancialDailyProduction).where(
                    FinancialDailyProduction.project_id == project_id,
                    FinancialDailyProduction.day == d,
                    FinancialDailyProduction.team_id == tid,
                )
            )
            if existing:
                existing.produced_value_brl = val
                existing.observation = obs
            else:
                db.add(
                    FinancialDailyProduction(
                        project_id=project_id,
                        day=d,
                        team_id=tid,
                        produced_value_brl=val,
                        observation=obs,
                    )
                )
            n += 1
        except Exception as e:
            errors.append(f"Linha {i}: {e}")
    if n:
        db.commit()
    return n, errors
