from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Farol = Literal["green", "yellow", "red"]


class LoginIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_master: bool
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreateByMaster(BaseModel):
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=4, max_length=128)
    is_master: bool = False


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=1024)
    obra_total_value_brl: Optional[float] = Field(None, ge=0, le=1e15)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=256)
    description: Optional[str] = Field(None, max_length=1024)
    obra_total_value_brl: Optional[float] = Field(None, ge=0, le=1e15)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    obra_total_value_brl: Optional[float] = None


class StageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=512)
    weight: float = Field(..., ge=0, le=1)
    total_quantity: float = Field(..., gt=0)
    unit: Optional[str] = None
    sort_order: int = 0


class StageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=512)
    weight: Optional[float] = Field(None, ge=0, le=1)
    total_quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = None
    sort_order: Optional[int] = None


class StageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    weight: float
    total_quantity: float
    unit: Optional[str]
    sort_order: int


class DailyEntryIn(BaseModel):
    day: date
    planned_optimistic: float = 0.0
    planned_pessimistic: float = 0.0
    executed: float = 0.0
    execution_note: Optional[str] = None


class DailyEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stage_id: int
    day: date
    planned_optimistic: float
    planned_pessimistic: float
    executed: float
    execution_note: Optional[str]


class StageDashboardRow(BaseModel):
    stage_id: int
    name: str
    unit: Optional[str]
    weight: float
    total_quantity: float
    farol: Farol
    pct_optimistic: float
    pct_pessimistic: float
    pct_executed: float
    deviation_vs_optimistic_pct: Optional[float]
    deviation_vs_pessimistic_pct: Optional[float]
    cumulative_executed: float
    cumulative_optimistic: float
    cumulative_pessimistic: float
    planning_sum_optimistic: float
    planning_sum_pessimistic: float
    pending_planning_optimistic: float
    pending_planning_pessimistic: float
    deviation_planning_optimistic_pct: Optional[float]
    deviation_planning_pessimistic_pct: Optional[float]
    farol_saldo: Farol


class ObraSummary(BaseModel):
    pct_optimistic: float
    pct_pessimistic: float
    pct_executed: float
    deviation_vs_optimistic_pct: Optional[float]
    deviation_vs_pessimistic_pct: Optional[float]
    trend_label: str
    trend_detail: str


class SeriesPoint(BaseModel):
    day: date
    optimistic: float
    pessimistic: float
    executed: Optional[float] = None


class DashboardOut(BaseModel):
    project_id: int
    project_name: str
    reference_date: Optional[date]
    last_execution_date: Optional[date]
    obra: ObraSummary
    series: List[SeriesPoint]
    stages: List[StageDashboardRow]


class BulkPlannedItem(BaseModel):
    stage_id: int
    day: date
    planned_optimistic: float = 0.0
    planned_pessimistic: float = 0.0


class BulkPlannedBody(BaseModel):
    entries: List[BulkPlannedItem]


class BulkExecutedItem(BaseModel):
    stage_id: int
    day: date
    executed: float = 0.0
    execution_note: Optional[str] = None


class BulkExecutedBody(BaseModel):
    entries: List[BulkExecutedItem]


# --- Avanço produtivo / financeiro (planilha CALCULO OBRA DAMHA — aba AVANÇO PRODUTIVO) ---


class FinancialEntryIn(BaseModel):
    exec_date: date
    team_type: str = Field("", max_length=128)
    segment: str = Field("", max_length=64)
    uen: str = Field("", max_length=64)
    obra_code: str = Field("", max_length=64)
    labor_code: str = Field("", max_length=64)
    description: str = Field("", max_length=512)
    quantity: float = Field(0.0, ge=-1e12, le=1e12)
    ups: float = Field(0.0, ge=-1e12, le=1e12)
    ups_brl: float = Field(0.0, ge=-1e12, le=1e12)
    value_brl: float = Field(0.0, ge=-1e12, le=1e12)
    ep_note: Optional[str] = Field(None, max_length=256)


class FinancialEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    exec_date: date
    team_type: str
    segment: str
    uen: str
    obra_code: str
    labor_code: str
    description: str
    quantity: float
    ups: float
    ups_brl: float
    value_brl: float
    ep_note: Optional[str]
    created_at: datetime


class FinancialPanelFiltersOut(BaseModel):
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    team_id: Optional[int] = None


class FinancialPanelSeriesPoint(BaseModel):
    day: date
    daily_planned_brl: float
    daily_produced_brl: float
    cumulative_planned_brl: float
    cumulative_produced_brl: float
    physical_executed_pct: float
    productive_advance_pct: float


class FinancialFarolDayRow(BaseModel):
    day: date
    planned_brl: float
    produced_brl: float
    teams_count: int
    farol: Farol


class FinancialPanelSummary(BaseModel):
    total_planned_brl: float
    total_produced_brl: float
    deviation_pct: Optional[float]
    last_data_day: Optional[date]


class FinancialTeamBriefOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    team_type: str
    uen: str
    encarregado: str
    default_daily_target_brl: Optional[float] = None


class FinancialPanelDashboardOut(BaseModel):
    project_id: int
    project_name: str
    obra_total_value_brl: Optional[float] = None
    filters: FinancialPanelFiltersOut
    summary: FinancialPanelSummary
    series: List[FinancialPanelSeriesPoint]
    farol_days: List[FinancialFarolDayRow]
    teams: List[FinancialTeamBriefOut]


class FinancialPhysicalComparisonPoint(BaseModel):
    day: date
    physical_executed_pct: float
    produced_value_brl: float
    cumulative_produced_value_brl: float
    billing_forecast_daily_brl: float


class FinancialPhysicalComparisonSummary(BaseModel):
    last_day: Optional[date]
    physical_executed_pct: float
    total_produced_brl: float
    obra_total_value_brl: float
    planned_financial_days_count: int
    daily_obra_reference_brl: float


class FinancialPhysicalComparisonOut(BaseModel):
    project_id: int
    project_name: str
    points: List[FinancialPhysicalComparisonPoint]
    summary: FinancialPhysicalComparisonSummary


class ObraFinancialAdvancePoint(BaseModel):
    day: date
    physical_executed_pct: float
    forecast_optimistic_brl: Optional[float] = None
    forecast_pessimistic_brl: Optional[float] = None


class ObraFinancialAdvanceOut(BaseModel):
    project_id: int
    project_name: str
    obra_total_value_brl: Optional[float] = None
    has_billing_forecasts: bool
    series: List[ObraFinancialAdvancePoint]


BillingForecastScenario = Literal["optimistic", "pessimistic"]


class BillingForecastIn(BaseModel):
    day: date
    scenario: BillingForecastScenario
    amount_brl: float = Field(..., ge=0, le=1e15)


class BillingForecastUpdate(BaseModel):
    day: Optional[date] = None
    scenario: Optional[BillingForecastScenario] = None
    amount_brl: Optional[float] = Field(None, ge=0, le=1e15)


class BillingForecastOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    day: date
    scenario: str
    amount_brl: float
    created_at: datetime


class CsvImportOut(BaseModel):
    upserted: int
    errors: List[str] = Field(default_factory=list)


class FinancialTeamIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    team_type: str = Field("", max_length=128)
    uen: str = Field("", max_length=128)
    encarregado: str = Field("", max_length=256)
    default_daily_target_brl: Optional[float] = Field(None, ge=0, le=1e15)


class FinancialTeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    team_type: str
    uen: str
    encarregado: str
    default_daily_target_brl: Optional[float] = None
    created_at: datetime


class FinancialDailyPlanIn(BaseModel):
    day: date
    team_id: int = Field(..., ge=1)
    daily_target_brl: float = Field(0.0, ge=-1e12, le=1e12)
    daily_planning_brl: float = Field(0.0, ge=-1e12, le=1e12)


class FinancialDailyPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    day: date
    team_id: int
    daily_target_brl: float
    daily_planning_brl: float
    created_at: datetime
    team: FinancialTeamBriefOut


class FinancialDailyProductionIn(BaseModel):
    day: date
    team_id: int = Field(..., ge=1)
    produced_value_brl: float = Field(0.0, ge=-1e12, le=1e12)
    observation: Optional[str] = Field(None, max_length=4000)


class FinancialDailyProductionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    day: date
    team_id: int
    produced_value_brl: float
    observation: Optional[str]
    created_at: datetime
    team: FinancialTeamBriefOut


class BackupEmailOut(BaseModel):
    ok: bool
    message: str
