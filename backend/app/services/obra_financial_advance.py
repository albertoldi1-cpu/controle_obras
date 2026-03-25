"""Avanço financeiro: avanço físico (curva S) + previsões de faturamento diário cadastradas na própria página."""
from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialBillingForecast, Project
from app.schemas import ObraFinancialAdvanceOut, ObraFinancialAdvancePoint
from app.services.dashboard import _weighted_series


def _physical_executed_by_day(project: Project) -> Dict[date, float]:
    stages = list(project.stages)
    days, _, _, pct_e = _weighted_series(stages)
    if not days:
        return {}
    return dict(zip(days, pct_e))


def _billing_by_scenario(
    db: Session, project_id: int
) -> tuple[Dict[date, float], Dict[date, float]]:
    rows = list(
        db.scalars(
            select(FinancialBillingForecast)
            .where(FinancialBillingForecast.project_id == project_id)
            .order_by(FinancialBillingForecast.day)
        ).all()
    )
    opt: Dict[date, float] = {}
    pes: Dict[date, float] = {}
    for r in rows:
        if r.scenario == "optimistic":
            opt[r.day] = float(r.amount_brl or 0.0)
        elif r.scenario == "pessimistic":
            pes[r.day] = float(r.amount_brl or 0.0)
    return opt, pes


def build_obra_financial_advance(db: Session, project: Project) -> ObraFinancialAdvanceOut:
    pid = project.id
    physical_by_day = _physical_executed_by_day(project)
    opt_by_day, pes_by_day = _billing_by_scenario(db, pid)
    has_forecasts = len(opt_by_day) > 0 or len(pes_by_day) > 0

    row_days = set(opt_by_day.keys()) | set(pes_by_day.keys())
    all_days = sorted(set(physical_by_day.keys()) | row_days)
    if not all_days:
        return ObraFinancialAdvanceOut(
            project_id=project.id,
            project_name=project.name,
            obra_total_value_brl=project.obra_total_value_brl,
            has_billing_forecasts=False,
            series=[],
        )

    series: List[ObraFinancialAdvancePoint] = []
    last_phys = 0.0
    for d in all_days:
        if d in physical_by_day:
            last_phys = physical_by_day[d]
        phys_pct = round(last_phys, 3)

        f_opt: Optional[float] = opt_by_day[d] if d in opt_by_day else None
        f_pes: Optional[float] = pes_by_day[d] if d in pes_by_day else None

        series.append(
            ObraFinancialAdvancePoint(
                day=d,
                physical_executed_pct=phys_pct,
                forecast_optimistic_brl=f_opt,
                forecast_pessimistic_brl=f_pes,
            )
        )

    return ObraFinancialAdvanceOut(
        project_id=project.id,
        project_name=project.name,
        obra_total_value_brl=project.obra_total_value_brl,
        has_billing_forecasts=has_forecasts,
        series=series,
    )
