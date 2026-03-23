"""Painel financeiro: planejado × produzido, curva acumulada e farol diário."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import FinancialDailyPlan, FinancialDailyProduction, Project
from app.schemas import (
    Farol,
    FinancialFarolDayRow,
    FinancialPanelDashboardOut,
    FinancialPanelFiltersOut,
    FinancialPanelSeriesPoint,
    FinancialPanelSummary,
)

# Banda “pessimista” para o farol (mesma ideia do avanço físico)
FIN_PEAK = 0.85


def _norm_team(s: str) -> str:
    return (s or "").strip()


def _farol(planned: float, produced: float) -> Farol:
    if planned <= 0 and produced <= 0:
        return "green"
    if planned <= 0:
        return "green"
    if produced >= planned:
        return "green"
    if produced >= planned * FIN_PEAK:
        return "yellow"
    return "red"


def _collect_team_types(plans: List[FinancialDailyPlan], prods: List[FinancialDailyProduction]) -> List[str]:
    seen = set()
    out: List[str] = []
    for row in plans:
        t = _norm_team(row.team_type) or "—"
        if t not in seen:
            seen.add(t)
            out.append(t)
    for row in prods:
        t = _norm_team(row.team_type) or "—"
        if t not in seen:
            seen.add(t)
            out.append(t)
    return sorted(out, key=lambda x: (x == "—", x.lower()))


def _filter_team_match(row_team: str, filt: Optional[str]) -> bool:
    if filt is None or filt == "":
        return True
    a = _norm_team(row_team) or "—"
    b = _norm_team(filt) or "—"
    return a.lower() == b.lower()


def build_financial_panel_dashboard(
    db: Session,
    project: Project,
    date_from: Optional[date],
    date_to: Optional[date],
    team_filter: Optional[str],
) -> FinancialPanelDashboardOut:
    pid = project.id
    q_plans = select(FinancialDailyPlan).where(FinancialDailyPlan.project_id == pid)
    q_prod = select(FinancialDailyProduction).where(FinancialDailyProduction.project_id == pid)
    if date_from:
        q_plans = q_plans.where(FinancialDailyPlan.day >= date_from)
        q_prod = q_prod.where(FinancialDailyProduction.day >= date_from)
    if date_to:
        q_plans = q_plans.where(FinancialDailyPlan.day <= date_to)
        q_prod = q_prod.where(FinancialDailyProduction.day <= date_to)

    plans = list(db.scalars(q_plans).all())
    prods = list(db.scalars(q_prod).all())

    all_team_types = _collect_team_types(
        list(db.scalars(select(FinancialDailyPlan).where(FinancialDailyPlan.project_id == pid)).all()),
        list(db.scalars(select(FinancialDailyProduction).where(FinancialDailyProduction.project_id == pid)).all()),
    )

    plans_f = [p for p in plans if _filter_team_match(p.team_type, team_filter)]
    prods_f = [p for p in prods if _filter_team_match(p.team_type, team_filter)]

    by_day_planned: dict[date, float] = defaultdict(float)
    by_day_produced: dict[date, float] = defaultdict(float)
    by_day_teams: dict[date, int] = defaultdict(int)

    for p in plans_f:
        by_day_planned[p.day] += float(p.daily_target_brl)
        by_day_teams[p.day] += int(p.teams_count or 0)
    for p in prods_f:
        by_day_produced[p.day] += float(p.produced_value_brl)

    all_days = sorted(set(by_day_planned.keys()) | set(by_day_produced.keys()))
    cum_p = 0.0
    cum_e = 0.0
    series: List[FinancialPanelSeriesPoint] = []
    farol_rows: List[FinancialFarolDayRow] = []

    for d in all_days:
        dp = by_day_planned.get(d, 0.0)
        dr = by_day_produced.get(d, 0.0)
        cum_p += dp
        cum_e += dr
        series.append(
            FinancialPanelSeriesPoint(
                day=d,
                daily_planned_brl=dp,
                daily_produced_brl=dr,
                cumulative_planned_brl=cum_p,
                cumulative_produced_brl=cum_e,
            )
        )
        farol_rows.append(
            FinancialFarolDayRow(
                day=d,
                planned_brl=dp,
                produced_brl=dr,
                teams_count=by_day_teams.get(d, 0),
                farol=_farol(dp, dr),
            )
        )

    total_p = sum(by_day_planned.values())
    total_r = sum(by_day_produced.values())
    dev: Optional[float] = None
    if total_p > 0:
        dev = (total_r - total_p) / total_p * 100.0
    last_day = max(all_days) if all_days else None

    summary = FinancialPanelSummary(
        total_planned_brl=total_p,
        total_produced_brl=total_r,
        deviation_pct=dev,
        last_data_day=last_day,
    )
    filters = FinancialPanelFiltersOut(
        date_from=date_from,
        date_to=date_to,
        team_type=team_filter if team_filter else None,
    )

    return FinancialPanelDashboardOut(
        project_id=project.id,
        project_name=project.name,
        filters=filters,
        summary=summary,
        series=series,
        farol_days=farol_rows,
        team_types=all_team_types,
    )


def financial_excel_bytes(
    db: Session,
    project: Project,
    date_from: Optional[date],
    date_to: Optional[date],
    team_filter: Optional[str],
) -> Tuple[bytes, str]:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    dash = build_financial_panel_dashboard(db, project, date_from, date_to, team_filter)
    wb = Workbook()
    # Painel
    ws0 = wb.active
    ws0.title = "Painel"
    ws0.append(["Projeto", dash.project_name])
    ws0.append(["Filtro data de", str(dash.filters.date_from or "")])
    ws0.append(["Filtro data até", str(dash.filters.date_to or "")])
    ws0.append(["Filtro equipe", dash.filters.team_type or "Todas"])
    ws0.append([])
    ws0.append(["Total planejado (R$)", dash.summary.total_planned_brl])
    ws0.append(["Total produzido (R$)", dash.summary.total_produced_brl])
    ws0.append(["Desvio %", dash.summary.deviation_pct if dash.summary.deviation_pct is not None else ""])
    ws0.append([])
    ws0.append(["Data", "Planejado dia", "Produzido dia", "Acum. planejado", "Acum. produzido"])
    for p in dash.series:
        ws0.append(
            [
                p.day.isoformat(),
                p.daily_planned_brl,
                p.daily_produced_brl,
                p.cumulative_planned_brl,
                p.cumulative_produced_brl,
            ]
        )
    ws0.append([])
    ws0.append(["Farol por dia"])
    ws0.append(["Data", "Planejado", "Produzido", "Qtd equipes", "Farol"])
    for f in dash.farol_days:
        ws0.append([f.day.isoformat(), f.planned_brl, f.produced_brl, f.teams_count, f.farol])

    # Planejamento
    ws1 = wb.create_sheet("Planejamento")
    ws1.append(["Data", "Tipo de equipe", "Qtd equipes no dia", "Meta diária (R$)"])
    q = select(FinancialDailyPlan).where(FinancialDailyPlan.project_id == project.id).order_by(FinancialDailyPlan.day)
    if date_from:
        q = q.where(FinancialDailyPlan.day >= date_from)
    if date_to:
        q = q.where(FinancialDailyPlan.day <= date_to)
    for row in db.scalars(q).all():
        if not _filter_team_match(row.team_type, team_filter):
            continue
        ws1.append(
            [
                row.day.isoformat(),
                _norm_team(row.team_type) or "—",
                row.teams_count,
                row.daily_target_brl,
            ]
        )

    # Lançamentos produtividade
    ws2 = wb.create_sheet("Lançamentos")
    ws2.append(["Data", "Tipo de equipe", "Valor produzido (R$)", "Observações"])
    q2 = select(FinancialDailyProduction).where(FinancialDailyProduction.project_id == project.id).order_by(
        FinancialDailyProduction.day
    )
    if date_from:
        q2 = q2.where(FinancialDailyProduction.day >= date_from)
    if date_to:
        q2 = q2.where(FinancialDailyProduction.day <= date_to)
    for row in db.scalars(q2).all():
        if not _filter_team_match(row.team_type, team_filter):
            continue
        ws2.append(
            [
                row.day.isoformat(),
                _norm_team(row.team_type) or "—",
                row.produced_value_brl,
                row.observation or "",
            ]
        )

    for ws in wb.worksheets:
        for c in ws[1]:
            if c.value:
                c.font = Font(bold=True)

    import io

    bio = io.BytesIO()
    wb.save(bio)
    fname = f"painel-financeiro-{project.id}.xlsx"
    return bio.getvalue(), fname
