"""Cálculos de curva S, farol e tendência — alinhados à lógica da planilha de avanço físico."""

from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import DailyEntry, Project, Stage


def _nf(v) -> float:
    """Coalesce None / valores inválidos para float seguro."""
    if v is None:
        return 0.0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _entries_by_stage(stages: list) -> Dict[int, Dict[date, Tuple[float, float, float]]]:
    """stage_id -> day -> (opt, pes, ex)"""
    out: Dict[int, Dict[date, Tuple[float, float, float]]] = defaultdict(dict)
    for st in stages:
        for e in st.entries:
            out[st.id][e.day] = (
                _nf(e.planned_optimistic),
                _nf(e.planned_pessimistic),
                _nf(e.executed),
            )
    return out


def _all_days(stages: list) -> List[date]:
    days: Set[date] = set()
    for st in stages:
        for e in st.entries:
            days.add(e.day)
    return sorted(days)


def _last_execution_day(stages: list) -> Optional[date]:
    """Último dia em que houve quantidade executada (>0) em alguma etapa."""
    last: Optional[date] = None
    for st in stages:
        for e in st.entries:
            if _nf(e.executed) > 0:
                last = max(last, e.day) if last else e.day
    return last


def _last_planning_days(stages: list) -> Tuple[Optional[date], Optional[date]]:
    """Último dia com lançamento de planejamento (otimista e pessimista)."""
    last_opt: Optional[date] = None
    last_pes: Optional[date] = None
    for st in stages:
        for e in st.entries:
            if _nf(e.planned_optimistic) > 0:
                last_opt = max(last_opt, e.day) if last_opt else e.day
            if _nf(e.planned_pessimistic) > 0:
                last_pes = max(last_pes, e.day) if last_pes else e.day
    return last_opt, last_pes


def _reference_date(stages: list) -> Optional[date]:
    """Último dia com execução; senão último dia com qualquer lançamento (para KPIs)."""
    last_exec = _last_execution_day(stages)
    if last_exec:
        return last_exec
    last_any: Optional[date] = None
    for st in stages:
        for e in st.entries:
            last_any = max(last_any, e.day) if last_any else e.day
    return last_any


def _stage_farol(p_opt: float, p_pes: float, p_real: float) -> str:
    if p_real + 1e-9 >= p_opt:
        return "green"
    if p_real + 1e-9 >= p_pes:
        return "yellow"
    return "red"


def _planning_sums_by_stage(db: Session, project_id: int) -> Dict[int, Tuple[float, float]]:
    """Soma SQL de planned_* por etapa (fonte única na base, robusto a NULL)."""
    rows = db.execute(
        select(
            DailyEntry.stage_id,
            func.coalesce(func.sum(DailyEntry.planned_optimistic), 0.0),
            func.coalesce(func.sum(DailyEntry.planned_pessimistic), 0.0),
        )
        .join(Stage, Stage.id == DailyEntry.stage_id)
        .where(Stage.project_id == project_id)
        .group_by(DailyEntry.stage_id)
    ).all()
    out: Dict[int, Tuple[float, float]] = {}
    for sid, sum_o, sum_p in rows:
        out[int(sid)] = (_nf(sum_o), _nf(sum_p))
    return out


def _stage_planning_farol(total_q: float, sum_o: float, sum_p: float) -> str:
    """Farol focado em fechamento do planejamento vs quantidade cadastrada (curva S)."""
    if total_q <= 1e-9:
        return "green"
    o_ok = sum_o + 1e-6 >= total_q
    p_ok = sum_p + 1e-6 >= total_q
    if o_ok and p_ok:
        return "green"
    if o_ok or p_ok:
        return "yellow"
    return "red"


def _planning_deviation_pct(planned_sum: float, total_q: float) -> Optional[float]:
    """Desvio % do planejado em relação ao cadastro: (Σ planejado - cadastro) / cadastro * 100."""
    if total_q <= 1e-9:
        return None
    return round((planned_sum - total_q) / total_q * 100.0, 2)


def _weighted_series(stages: list) -> Tuple[List[date], List[float], List[float], List[float]]:
    days = _all_days(stages)
    if not days:
        return [], [], [], []

    by_stage = _entries_by_stage(stages)
    n = len(days)
    cum_opt = [0.0] * n
    cum_pes = [0.0] * n
    cum_ex = [0.0] * n

    for st in stages:
        q = float(st.total_quantity)
        if q <= 0:
            continue
        w = float(st.weight)
        ed = by_stage.get(st.id, {})
        co = cp = cx = 0.0
        for i, d in enumerate(days):
            o, p, x = ed.get(d, (0.0, 0.0, 0.0))
            co += o
            cp += p
            cx += x
            cum_opt[i] += w * min(co / q, 1.0)
            cum_pes[i] += w * min(cp / q, 1.0)
            cum_ex[i] += w * min(cx / q, 1.0)

    pct_o = [round(v * 100, 3) for v in cum_opt]
    pct_p = [round(v * 100, 3) for v in cum_pes]
    pct_e = [round(v * 100, 3) for v in cum_ex]
    return days, pct_o, pct_p, pct_e


def _stage_metrics_at_day(
    stage, day: date, by_stage: Dict[int, Dict[date, Tuple[float, float, float]]]
) -> Tuple[float, float, float, float, float, float]:
    q = float(stage.total_quantity)
    ed = by_stage.get(stage.id, {})
    day_list = sorted(d for d in ed.keys() if d <= day)
    co = cp = cx = 0.0
    for d in day_list:
        o, p, x = ed[d]
        co += o
        cp += p
        cx += x
    p_opt = min(co / q, 1.0) if q else 0.0
    p_pes = min(cp / q, 1.0) if q else 0.0
    p_real = min(cx / q, 1.0) if q else 0.0
    return p_opt, p_pes, p_real, co, cp, cx


def _obra_at_index(
    stages: list,
    idx: int,
    days: List[date],
    series_o: List[float],
    series_p: List[float],
    series_e: List[float],
) -> Tuple[float, float, float]:
    if idx < 0 or not days:
        return 0.0, 0.0, 0.0
    i = min(idx, len(series_e) - 1)
    return series_o[i], series_p[i], series_e[i]


def rel_deviation_pct(actual_pct: float, baseline_pct: float) -> Optional[float]:
    """Desvio percentual relativo: (realizado - base) / base * 100. Base em % da obra."""
    if baseline_pct <= 1e-6:
        return None
    return round((actual_pct - baseline_pct) / baseline_pct * 100, 2)


def compute_trend(stages: list, days: List[date], series_e: List[float]) -> Tuple[str, str]:
    if len(days) < 4:
        return "Dados insuficientes", "Cadastre mais dias com execução para estimar tendência."

    by_stage = _entries_by_stage(stages)
    daily_ex: List[float] = []
    for d in days:
        s = 0.0
        for st in stages:
            t = by_stage.get(st.id, {}).get(d)
            if t:
                s += t[2]
        daily_ex.append(s)

    mid = len(daily_ex) // 2
    first = daily_ex[:mid] or daily_ex
    second = daily_ex[mid:] or daily_ex
    avg_a = sum(first) / len(first)
    avg_b = sum(second) / len(second)

    if avg_a < 1e-9:
        rhythm = "Ritmo recente em comparação com o período inicial não pode ser calculado (execução zero no início)."
    elif avg_b > avg_a * 1.12:
        rhythm = "Volume diário executado (soma das etapas) está em aceleração frente à primeira metade do período."
    elif avg_b < avg_a * 0.88:
        rhythm = "Volume diário executado desacelerou frente à primeira metade do período."
    else:
        rhythm = "Volume diário executado permanece relativamente estável entre as metades do período."

    tail = min(10, len(series_e))
    if tail >= 3:
        ys = series_e[-tail:]
        slope = (ys[-1] - ys[0]) / (tail - 1)
        if slope > 0.35:
            adv = "Avanço acumulado da obra (ponderado) mostra inclinação forte nos últimos dias."
        elif slope > 0.08:
            adv = "Avanço acumulado da obra segue em ritmo consistente de alta nos últimos dias."
        elif slope < -0.08:
            adv = "Atenção: avanço acumulado perdeu ritmo nos últimos dias (estagnação ou replanejamento)."
        else:
            adv = "Avanço acumulado da obra está estável no curto prazo."
    else:
        adv = "Poucos pontos na curva para inferir inclinação recente."

    label_parts = []
    if "aceleração" in rhythm:
        label_parts.append("Execução em aceleração")
    elif "desacelerou" in rhythm:
        label_parts.append("Execução em desaceleração")
    else:
        label_parts.append("Ritmo estável")

    if "inclinação forte" in adv or "consistente de alta" in adv:
        label_parts.append("· avanço em alta")
    elif "perdeu ritmo" in adv:
        label_parts.append("· avanço fraco")

    return " ".join(label_parts), f"{rhythm} {adv}"


def build_dashboard(db: Session, project: Project) -> dict:
    stages = list(project.stages)
    ref = _reference_date(stages)
    last_ex = _last_execution_day(stages)
    days, pct_o, pct_p, pct_e = _weighted_series(stages)
    last_plan_opt, last_plan_pes = _last_planning_days(stages)

    by_stage = _entries_by_stage(stages)
    planning_sums = _planning_sums_by_stage(db, project.id)

    stage_rows: List[dict] = []
    for st in sorted(stages, key=lambda s: (s.sort_order, s.id)):
        if ref is not None:
            p_opt, p_pes, p_real, co, cp, cx = _stage_metrics_at_day(st, ref, by_stage)
            farol = _stage_farol(p_opt, p_pes, p_real)
        else:
            p_opt = p_pes = p_real = 0.0
            co = cp = cx = 0.0
            farol = "red"
        pct_ex = p_real * 100
        pct_ox = p_opt * 100
        pct_px = p_pes * 100
        tq = float(st.total_quantity)
        sum_plan_o, sum_plan_p = planning_sums.get(st.id, (0.0, 0.0))
        pending_o = max(tq - sum_plan_o, 0.0)
        pending_p = max(tq - sum_plan_p, 0.0)
        pending_exec = max(tq - cx, 0.0)
        stage_rows.append(
            {
                "stage_id": st.id,
                "name": st.name,
                "unit": st.unit,
                "weight": st.weight,
                "total_quantity": st.total_quantity,
                "farol": farol,
                "pct_optimistic": round(pct_ox, 2),
                "pct_pessimistic": round(pct_px, 2),
                "pct_executed": round(pct_ex, 2),
                "deviation_vs_optimistic_pct": rel_deviation_pct(pct_ex, pct_ox),
                "deviation_vs_pessimistic_pct": rel_deviation_pct(pct_ex, pct_px),
                "cumulative_executed": round(cx, 3),
                "cumulative_optimistic": round(co, 3),
                "cumulative_pessimistic": round(cp, 3),
                "planning_sum_optimistic": round(sum_plan_o, 3),
                "planning_sum_pessimistic": round(sum_plan_p, 3),
                "pending_planning_optimistic": round(pending_o, 3),
                "pending_planning_pessimistic": round(pending_p, 3),
                "deviation_planning_optimistic_pct": _planning_deviation_pct(sum_plan_o, tq),
                "deviation_planning_pessimistic_pct": _planning_deviation_pct(sum_plan_p, tq),
                "farol_saldo": _stage_planning_farol(tq, sum_plan_o, sum_plan_p),
                "pending_execution_quantity": round(pending_exec, 3),
            }
        )

    obra_opt = obra_pes = obra_ex = 0.0
    if ref is not None and days:
        idx = days.index(ref) if ref in days else len(days) - 1
        obra_opt, obra_pes, obra_ex = _obra_at_index(stages, idx, days, pct_o, pct_p, pct_e)

    trend_label, trend_detail = compute_trend(stages, days, pct_e)

    series: List[dict] = []
    for i, d in enumerate(days):
        ex_val: Optional[float] = None
        if last_ex is not None and d <= last_ex:
            ex_val = pct_e[i]
        opt_val: Optional[float] = pct_o[i] if (last_plan_opt is None or d <= last_plan_opt) else None
        pes_val: Optional[float] = pct_p[i] if (last_plan_pes is None or d <= last_plan_pes) else None
        series.append(
            {
                "day": d,
                "optimistic": opt_val,
                "pessimistic": pes_val,
                "executed": ex_val,
            }
        )

    return {
        "project_id": project.id,
        "project_name": project.name,
        "reference_date": ref,
        "last_execution_date": last_ex,
        "obra": {
            "pct_optimistic": obra_opt,
            "pct_pessimistic": obra_pes,
            "pct_executed": obra_ex,
            "deviation_vs_optimistic_pct": rel_deviation_pct(obra_ex, obra_opt),
            "deviation_vs_pessimistic_pct": rel_deviation_pct(obra_ex, obra_pes),
            "trend_label": trend_label,
            "trend_detail": trend_detail,
        },
        "series": series,
        "stages": stage_rows,
    }
