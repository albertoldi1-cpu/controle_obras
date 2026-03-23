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

    stages: Mapped[List["Stage"]] = relationship(
        "Stage", back_populates="project", cascade="all, delete-orphan", order_by="Stage.sort_order"
    )
    financial_entries: Mapped[List["FinancialProductionEntry"]] = relationship(
        "FinancialProductionEntry",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="FinancialProductionEntry.exec_date, FinancialProductionEntry.id",
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
