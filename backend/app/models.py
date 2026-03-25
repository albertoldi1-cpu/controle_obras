from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    is_master: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Valor total da obra (R$) — usado em % avanço produtivo e comparativos (ex.: curva / meta diária).
    obra_total_value_brl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    stages: Mapped[List["Stage"]] = relationship(
        "Stage", back_populates="project", cascade="all, delete-orphan", order_by="Stage.sort_order"
    )
    financial_entries: Mapped[List["FinancialProductionEntry"]] = relationship(
        "FinancialProductionEntry",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialProductionEntry.exec_date, FinancialProductionEntry.id",
    )
    financial_teams: Mapped[List["FinancialTeam"]] = relationship(
        "FinancialTeam",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialTeam.name",
    )
    financial_daily_plans: Mapped[List["FinancialDailyPlan"]] = relationship(
        "FinancialDailyPlan",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialDailyPlan.day, FinancialDailyPlan.team_id",
    )
    financial_daily_production: Mapped[List["FinancialDailyProduction"]] = relationship(
        "FinancialDailyProduction",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialDailyProduction.day, FinancialDailyProduction.team_id",
    )
    financial_obra_plan_daily: Mapped[List["FinancialObraPlanDaily"]] = relationship(
        "FinancialObraPlanDaily",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialObraPlanDaily.day",
    )
    financial_billing_forecasts: Mapped[List["FinancialBillingForecast"]] = relationship(
        "FinancialBillingForecast",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialBillingForecast.day, FinancialBillingForecast.scenario",
    )


class Stage(Base):
    __tablename__ = "stages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=0.01)
    total_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped["Project"] = relationship("Project", back_populates="stages")
    entries: Mapped[List["DailyEntry"]] = relationship(
        "DailyEntry", back_populates="stage", cascade="all, delete-orphan"
    )


class DailyEntry(Base):
    __tablename__ = "daily_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False)
    planned_optimistic: Mapped[float] = mapped_column(Float, default=0.0)
    planned_pessimistic: Mapped[float] = mapped_column(Float, default=0.0)
    executed: Mapped[float] = mapped_column(Float, default=0.0)
    execution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    stage: Mapped["Stage"] = relationship("Stage", back_populates="entries")

    __table_args__ = (UniqueConstraint("stage_id", "day", name="uq_stage_day"),)


class FinancialProductionEntry(Base):
    """Lançamentos no modelo da planilha «avanço produtivo» (mão de obra / valor)."""

    __tablename__ = "financial_production_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    exec_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    team_type: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    segment: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    uen: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    obra_code: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    labor_code: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    description: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ups: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ups_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    value_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ep_note: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_entries")


class FinancialTeam(Base):
    """Equipe cadastrada no projeto (nome, tipo, UEN, encarregado)."""

    __tablename__ = "financial_teams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    team_type: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    uen: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    encarregado: Mapped[str] = mapped_column(String(256), default="", nullable=False)
    # Meta diária padrão (R$) — sugerida ao lançar planejamento / produção por equipe.
    default_daily_target_brl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_teams")
    daily_plans: Mapped[List["FinancialDailyPlan"]] = relationship(
        "FinancialDailyPlan", back_populates="team", cascade="all, delete-orphan"
    )
    daily_production: Mapped[List["FinancialDailyProduction"]] = relationship(
        "FinancialDailyProduction", back_populates="team", cascade="all, delete-orphan"
    )


class FinancialDailyPlan(Base):
    """Planejamento financeiro diário: meta (valor planejado) por equipe cadastrada."""

    __tablename__ = "financial_daily_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("financial_teams.id", ondelete="CASCADE"), index=True)
    daily_target_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Planejamento diário (R$) — além da meta da equipe; usado no farol quando informado.
    daily_planning_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_daily_plans")
    team: Mapped["FinancialTeam"] = relationship("FinancialTeam", back_populates="daily_plans")

    __table_args__ = (UniqueConstraint("project_id", "day", "team_id", name="uq_fin_plan_proj_day_team"),)


class FinancialDailyProduction(Base):
    """Lançamento de produtividade financeira: valor produzido por equipe e dia."""

    __tablename__ = "financial_daily_production"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("financial_teams.id", ondelete="CASCADE"), index=True)
    produced_value_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    observation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_daily_production")
    team: Mapped["FinancialTeam"] = relationship("FinancialTeam", back_populates="daily_production")

    __table_args__ = (UniqueConstraint("project_id", "day", "team_id", name="uq_fin_prod_proj_day_team"),)


class FinancialObraPlanDaily(Base):
    """Faturamento diário (R$) importado da folha «AVANÇO FINANCEIRO»: otimista (linhas 4+13) e pessimista (16+25)."""

    __tablename__ = "financial_obra_plan_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    planned_increment_brl: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # Faturamento diário pessimista (import linhas 16 + 25); NULL se o dia só existe no cenário otimista.
    planned_pessimistic_brl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_obra_plan_daily")

    __table_args__ = (UniqueConstraint("project_id", "day", name="uq_fin_obra_plan_proj_day"),)


class FinancialBillingForecast(Base):
    """Previsão de faturamento diário (R$) por cenário — cadastro manual na página Avanço financeiro."""

    __tablename__ = "financial_billing_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scenario: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_brl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="financial_billing_forecasts")

    __table_args__ = (
        UniqueConstraint("project_id", "day", "scenario", name="uq_fin_billing_proj_day_scenario"),
    )
