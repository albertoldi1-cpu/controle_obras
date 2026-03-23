"""Cálculos de curva S, farol e tendência — alinhados à lógica da planilha de avanço físico."""

from collections import defaultdict
from datetime import date
from typing import Dict, List, Optional, Set, Tuple

from app.models import Project


def _entries_by_stage(stages: list) -> Dict[int, Dict[date, Tuple[float, float, float]]]:
    """stage_id -> day -> (opt, pes, ex)"""
    out: Dict[int, Dict[date, Tuple[float, float, float]]] = defaultdict(dict)
    for st in stages:
        for e in st.entries:
            out[st.id][e.day] = (e.planned_optimistic, e.planned_pessimistic, e.executed)
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
            if e.executed and e.executed > 0:
                last = max(last, e.day) if last else e.day
    return last


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


def _stage_balance_farol(saldo_pes: float, saldo_opt: float) -> str:
    # Verde: planejamento pessimista já zerado.
    # Amarelo: pessimista ainda aberto, mas otimista já zerado.
    # Vermelho: ambos cenários ainda têm saldo faltante.
    if saldo_pes <= 1e-6:
        return "green"
    if saldo_opt <= 1e-6:
        return "yellow"
    return "red"


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


def build_dashboard(project: Project) -> dict:
    stages = list(project.stages)
    ref = _reference_date(stages)
    last_ex = _last_execution_day(stages)
    days, pct_o, pct_p, pct_e = _weighted_series(stages)

    by_stage = _entries_by_stage(stages)

    stage_rows: List[dict] = []
    if ref is not None:
        for st in sorted(stages, key=lambda s: (s.sort_order, s.id)):
            p_opt, p_pes, p_real, co, cp, cx = _stage_metrics_at_day(st, ref, by_stage)
            farol = _stage_farol(p_opt, p_pes, p_real)
            pct_ex = p_real * 100
            pct_ox = p_opt * 100
            pct_px = p_pes * 100
            saldo_exec = max(float(st.total_quantity) - cx, 0.0)
            saldo_opt = max(float(st.total_quantity) - co, 0.0)
            saldo_pes = max(float(st.total_quantity) - cp, 0.0)
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
                    "saldo_faltante_executado": round(saldo_exec, 3),
                    "saldo_faltante_optimista": round(saldo_opt, 3),
                    "saldo_faltante_pessimista": round(saldo_pes, 3),
                    "farol_saldo": _stage_balance_farol(saldo_pes, saldo_opt),
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
        series.append(
            {
                "day": d,
                "optimistic": pct_o[i],
                "pessimistic": pct_p[i],
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
