"""Avanço financeiro: avanço físico (curva S) + faturamento diário otimista/pessimista (import planilha)."""
from __future__ import annotations

import re
from datetime import date, datetime
from io import BytesIO
from typing import Dict, List, Optional, Tuple

from openpyxl import load_workbook
from openpyxl.utils.datetime import from_excel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FinancialObraPlanDaily, Project
from app.schemas import ObraFinancialAdvanceOut, ObraFinancialAdvancePoint
from app.services.dashboard import _weighted_series


# Layout Excel (1-based): datas na linha 4 / valores linha 13 (otimista); datas linha 16 / valores linha 25 (pessimista).
_ROW_DATES_OPT = 4
_ROW_VALUES_OPT = 13
_ROW_DATES_PES = 16
_ROW_VALUES_PES = 25


def _cell_to_date(v) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    if isinstance(v, (int, float)):
        try:
            return from_excel(v).date()
        except Exception:
            return None
    return None


def _float_cell(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        if not s:
            return None
        try:
            return float(s)
        except ValueError:
            return None
    return None


def _norm_sheet_title(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _parse_date_value_rows(
    rows: list,
    date_row_excel: int,
    value_row_excel: int,
) -> Dict[date, float]:
    """Alinha por índice de coluna: linha de datas (Excel 1-based) × linha de valores."""
    di = date_row_excel - 1
    vi = value_row_excel - 1
    if di < 0 or vi < 0 or di >= len(rows) or vi >= len(rows):
        return {}
    dr = list(rows[di] or ())
    vr = list(rows[vi] or ())
    n = max(len(dr), len(vr))
    out: Dict[date, float] = {}
    for j in range(n):
        d = _cell_to_date(dr[j] if j < len(dr) else None)
        v = _float_cell(vr[j] if j < len(vr) else None)
        if d is not None and v is not None:
            out[d] = v
    return out


def parse_avanco_financeiro_xlsx(content: bytes) -> Tuple[Dict[date, float], Dict[date, float], List[str]]:
    """
    Folha «AVANÇO FINANCEIRO»: faturamento diário (R$) por coluna.
    Otimista: linha 4 = datas (eixo X), linha 13 = valores (eixo Y).
    Pessimista: linha 16 = datas, linha 25 = valores.
    """
    wb = load_workbook(filename=BytesIO(content), read_only=True, data_only=True)
    try:
        ws = None
        for name in wb.sheetnames:
            n = _norm_sheet_title(name)
            if "avan" in n and "financeir" in n:
                ws = wb[name]
                break
        if ws is None:
            for name in wb.sheetnames:
                if "financeir" in _norm_sheet_title(name):
                    ws = wb[name]
                    break
        if ws is None:
            ws = wb[wb.sheetnames[0]]

        rows = list(ws.iter_rows(values_only=True))
    finally:
        wb.close()

    errors: List[str] = []
    optimistic = _parse_date_value_rows(rows, _ROW_DATES_OPT, _ROW_VALUES_OPT)
    pessimistic = _parse_date_value_rows(rows, _ROW_DATES_PES, _ROW_VALUES_PES)

    if not optimistic:
        raise ValueError(
            "Não foi possível ler o cenário otimista: verifique a folha «AVANÇO FINANCEIRO», "
            f"linha {_ROW_DATES_OPT} (datas) e linha {_ROW_VALUES_OPT} (valores diários R$)."
        )
    if not pessimistic:
        errors.append(
            f"Cenário pessimista vazio: confira linha {_ROW_DATES_PES} (datas) e linha {_ROW_VALUES_PES} (valores). "
            "Só o otimista foi importado."
        )

    return optimistic, pessimistic, errors


def replace_project_obra_plan(
    db: Session,
    project_id: int,
    optimistic: Dict[date, float],
    pessimistic: Dict[date, float],
) -> int:
    db.query(FinancialObraPlanDaily).filter(FinancialObraPlanDaily.project_id == project_id).delete(
        synchronize_session=False
    )
    all_days = set(optimistic.keys()) | set(pessimistic.keys())
    n = 0
    for d in sorted(all_days):
        db.add(
            FinancialObraPlanDaily(
                project_id=project_id,
                day=d,
                planned_increment_brl=float(optimistic.get(d, 0.0)),
                planned_pessimistic_brl=float(pessimistic[d]) if d in pessimistic else None,
            )
        )
        n += 1
    db.commit()
    return n


def _physical_executed_by_day(project: Project) -> Dict[date, float]:
    stages = list(project.stages)
    days, _, _, pct_e = _weighted_series(stages)
    if not days:
        return {}
    return dict(zip(days, pct_e))


def build_obra_financial_advance(db: Session, project: Project) -> ObraFinancialAdvanceOut:
    pid = project.id
    physical_by_day = _physical_executed_by_day(project)

    imported_rows = list(
        db.scalars(
            select(FinancialObraPlanDaily)
            .where(FinancialObraPlanDaily.project_id == pid)
            .order_by(FinancialObraPlanDaily.day)
        ).all()
    )
    row_by_day = {r.day: r for r in imported_rows}
    has_import = len(imported_rows) > 0

    all_days = sorted(set(physical_by_day.keys()) | set(row_by_day.keys()))
    if not all_days:
        return ObraFinancialAdvanceOut(
            project_id=project.id,
            project_name=project.name,
            obra_total_value_brl=project.obra_total_value_brl,
            source_planned="none",  # type: ignore[arg-type]
            series=[],
        )

    source: str = "imported" if has_import else "none"

    series: List[ObraFinancialAdvancePoint] = []
    last_phys = 0.0
    for d in all_days:
        if d in physical_by_day:
            last_phys = physical_by_day[d]
        phys_pct = round(last_phys, 3)

        row = row_by_day.get(d)
        f_opt: Optional[float] = None
        f_pes: Optional[float] = None
        if row is not None:
            f_opt = float(row.planned_increment_brl or 0.0)
            if row.planned_pessimistic_brl is not None:
                f_pes = float(row.planned_pessimistic_brl)

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
        source_planned=source,  # type: ignore[arg-type]
        series=series,
    )
