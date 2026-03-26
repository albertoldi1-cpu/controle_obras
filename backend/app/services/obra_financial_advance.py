"""Avanço financeiro: avanço físico (curva S) + previsões de faturamento diário cadastradas na própria página."""
from __future__ import annotations

from datetime import date
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialBillingForecast, FinancialDailyProduction, Project
from app.schemas import ObraFinancialAdvanceOut, ObraFinancialAdvancePoint


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
    opt_by_day, pes_by_day = _billing_by_scenario(db, pid)

    prod_rows = list(
        db.scalars(
            select(FinancialDailyProduction)
            .where(FinancialDailyProduction.project_id == pid)
            .order_by(FinancialDailyProduction.day)
        ).all()
    )
    produced_by_day: Dict[date, float] = {}
    for r in prod_rows:
        produced_by_day[r.day] = produced_by_day.get(r.day, 0.0) + float(r.produced_value_brl or 0.0)
    has_forecasts = len(opt_by_day) > 0 or len(pes_by_day) > 0

    row_days = set(opt_by_day.keys()) | set(pes_by_day.keys())
    prod_days = set(produced_by_day.keys())
    all_days = sorted(row_days | prod_days)
    if not all_days:
        return ObraFinancialAdvanceOut(
            project_id=project.id,
            project_name=project.name,
            obra_total_value_brl=project.obra_total_value_brl,
            total_produced_brl=0.0,
            has_billing_forecasts=False,
            series=[],
        )

    series: List[ObraFinancialAdvancePoint] = []
    cum_prod = 0.0
    for d in all_days:
        produced_acc: Optional[float] = None
        if d in produced_by_day:
            cum_prod += produced_by_day[d]
            produced_acc = round(cum_prod, 2)

        f_opt: Optional[float] = opt_by_day[d] if d in opt_by_day else None
        f_pes: Optional[float] = pes_by_day[d] if d in pes_by_day else None

        series.append(
            ObraFinancialAdvancePoint(
                day=d,
                produced_accumulated_brl=produced_acc,
                forecast_optimistic_brl=f_opt,
                forecast_pessimistic_brl=f_pes,
            )
        )

    return ObraFinancialAdvanceOut(
        project_id=project.id,
        project_name=project.name,
        obra_total_value_brl=project.obra_total_value_brl,
        total_produced_brl=round(sum(produced_by_day.values()), 2),
        has_billing_forecasts=has_forecasts,
        series=series,
    )
