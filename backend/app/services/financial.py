"""Painel financeiro — espelha a lógica da aba «avanço produtivo» (custos por lançamento)."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import List

from app.models import FinancialProductionEntry, Project
from app.schemas import (
    FinancialDashboardOut,
    FinancialEntryOut,
    FinancialSeriesPoint,
    FinancialSummary,
    FinancialByTeamRow,
)


def _project_entries_query(project_id: int):
    return select(FinancialProductionEntry).where(FinancialProductionEntry.project_id == project_id)


def build_financial_dashboard(project: Project) -> FinancialDashboardOut:
    entries = list(project.financial_entries) if project.financial_entries else []
    entries.sort(key=lambda e: (e.exec_date, e.id))

    total_value = sum(e.value_brl for e in entries)
    total_ups = sum(e.ups for e in entries)
    by_team: dict[str, float] = defaultdict(float)
    for e in entries:
        by_team[e.team_type or "—"] += e.value_brl

    by_day_val: dict[date, float] = defaultdict(float)
    for e in entries:
        by_day_val[e.exec_date] += e.value_brl

    days_sorted = sorted(by_day_val.keys())
    cum = 0.0
    series: List[FinancialSeriesPoint] = []
    for d in days_sorted:
        cum += by_day_val[d]
        series.append(FinancialSeriesPoint(day=d, daily_value=by_day_val[d], cumulative_value=cum))

    last_day = max(days_sorted) if days_sorted else None

    by_team_rows = [
        FinancialByTeamRow(team_type=k, total_brl=v, pct_of_total=(100.0 * v / total_value if total_value > 0 else 0.0))
        for k, v in sorted(by_team.items(), key=lambda x: -x[1])
    ]

    summary = FinancialSummary(
        entry_count=len(entries),
        total_value_brl=total_value,
        total_ups=total_ups,
        last_exec_date=last_day,
        avg_value_per_entry=total_value / len(entries) if entries else 0.0,
    )

    return FinancialDashboardOut(
        project_id=project.id,
        project_name=project.name,
        summary=summary,
        series=series,
        by_team=by_team_rows,
        recent_entries=[FinancialEntryOut.model_validate(e) for e in entries[-50:][::-1]],
    )
