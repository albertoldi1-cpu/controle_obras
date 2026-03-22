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
    description: Optional[str] = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str]
    created_at: datetime


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
