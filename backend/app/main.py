import os
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth_core import create_access_token, hash_password, verify_password
from app.auth_util import master_password, master_username
from app.backup_export import send_backup_via_smtp
from app.database import SessionLocal, get_db, init_db
from app.deps import get_current_user, require_master
from app.models import (
    DailyEntry,
    FinancialDailyPlan,
    FinancialDailyProduction,
    FinancialProductionEntry,
    FinancialTeam,
    Project,
    Stage,
    User,
)
from app.rate_limit import login_rate_limited, register_login_attempt
from app.schemas import (
    BackupEmailOut,
    BulkExecutedBody,
    BulkPlannedBody,
    DailyEntryIn,
    DailyEntryOut,
    DashboardOut,
    FinancialDailyPlanIn,
    FinancialDailyPlanOut,
    FinancialDailyProductionIn,
    FinancialDailyProductionOut,
    FinancialEntryIn,
    FinancialEntryOut,
    FinancialPhysicalComparisonOut,
    FinancialPanelDashboardOut,
    FinancialTeamIn,
    FinancialTeamOut,
    LoginIn,
    ProjectCreate,
    ProjectOut,
    StageCreate,
    StageOut,
    StageUpdate,
    TokenOut,
    UserCreateByMaster,
    UserOut,
)
from app.services.dashboard import build_dashboard
from app.services.financial import (
    build_financial_panel_dashboard,
    build_financial_physical_comparison,
    financial_physical_comparison_excel_bytes,
    financial_excel_bytes,
)
from app.settings import cors_origins, docs_enabled

app = FastAPI(
    title="Controle de Obras de Grande Porte",
    version="1.2.0",
    docs_url="/docs" if docs_enabled() else None,
    redoc_url="/redoc" if docs_enabled() else None,
    openapi_url="/openapi.json" if docs_enabled() else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if os.getenv("RENDER", "").lower() == "true" or os.getenv("ENVIRONMENT", "").lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

_FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _FRONTEND_DIST.is_dir():
    _assets_dir = _FRONTEND_DIST / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")


def bootstrap_master(db: Session) -> None:
    n = db.scalar(select(func.count(User.id)))
    if n and n > 0:
        return
    u = master_username()
    p = master_password()
    db.add(
        User(
            username=u,
            password_hash=hash_password(p),
            is_master=True,
            is_active=True,
        )
    )
    db.commit()


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        bootstrap_master(db)
    finally:
        db.close()


@app.get("/")
def root():
    idx = _FRONTEND_DIST / "index.html"
    if idx.is_file():
        return FileResponse(idx)
    return {
        "service": "Controle de Obras de Grande Porte API",
        "docs": "/docs",
        "health": "/api/health",
        "hint": "Interface em http://127.0.0.1:5173 após login em /api/auth/login",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# --- Auth ---


@app.post("/api/auth/login", response_model=TokenOut)
def login(request: Request, body: LoginIn, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    if login_rate_limited(ip):
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas de login. Aguarde alguns minutos.",
        )
    uname = body.username.strip()
    user = db.scalar(select(User).where(func.lower(User.username) == uname.lower()))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        register_login_attempt(ip)
        raise HTTPException(
            status_code=401,
            detail="Usuário ou senha incorretos. Se acabou de mudar o master no código, rode: python3 scripts/reset_master.py",
        )
    token = create_access_token(user.id, user.username, user.is_master)
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@app.get("/api/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.get("/api/users", response_model=List[UserOut])
def list_users(_: User = Depends(require_master), db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@app.post("/api/users", response_model=UserOut)
def create_user(
    body: UserCreateByMaster,
    _: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    nu = body.username.strip()
    if db.scalar(select(User).where(func.lower(User.username) == nu.lower())):
        raise HTTPException(400, "Nome de usuário já existe")
    u = User(
        username=nu,
        password_hash=hash_password(body.password),
        is_master=body.is_master,
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@app.post("/api/admin/backup/email", response_model=BackupEmailOut)
def admin_backup_email(_: User = Depends(require_master), db: Session = Depends(get_db)):
    ok, msg = send_backup_via_smtp(db)
    if not ok:
        raise HTTPException(status_code=503, detail=msg)
    return BackupEmailOut(ok=True, message=msg)


@app.delete("/api/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(require_master),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(400, "Não é possível excluir o próprio usuário")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    db.delete(u)
    db.commit()
    return {"ok": True}


# --- Projetos ---


@app.post("/api/projects", response_model=ProjectOut)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = Project(name=body.name.strip(), description=(body.description or "").strip() or None)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@app.get("/api/projects", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.scalars(select(Project).order_by(Project.id.desc())).all()


@app.get("/api/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    return p


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


# --- Etapas ---


@app.post("/api/projects/{project_id}/stages", response_model=StageOut)
def create_stage(
    project_id: int,
    body: StageCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    st = Stage(
        project_id=project_id,
        name=body.name.strip(),
        weight=body.weight,
        total_quantity=body.total_quantity,
        unit=body.unit,
        sort_order=body.sort_order,
    )
    db.add(st)
    db.commit()
    db.refresh(st)
    return st


@app.get("/api/projects/{project_id}/stages", response_model=List[StageOut])
def list_stages(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    return db.scalars(
        select(Stage).where(Stage.project_id == project_id).order_by(Stage.sort_order, Stage.id)
    ).all()


@app.patch("/api/stages/{stage_id}", response_model=StageOut)
def update_stage(
    stage_id: int,
    body: StageUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    st = db.get(Stage, stage_id)
    if not st:
        raise HTTPException(404, "Etapa não encontrada")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(st, k, v)
    db.commit()
    db.refresh(st)
    return st


@app.delete("/api/stages/{stage_id}")
def delete_stage(stage_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    st = db.get(Stage, stage_id)
    if not st:
        raise HTTPException(404, "Etapa não encontrada")
    db.delete(st)
    db.commit()
    return {"ok": True}


# --- Lançamentos ---


@app.get("/api/stages/{stage_id}/entries", response_model=List[DailyEntryOut])
def list_entries(stage_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    st = db.get(Stage, stage_id)
    if not st:
        raise HTTPException(404, "Etapa não encontrada")
    return db.scalars(
        select(DailyEntry).where(DailyEntry.stage_id == stage_id).order_by(DailyEntry.day)
    ).all()


@app.put("/api/stages/{stage_id}/entries/{day}", response_model=DailyEntryOut)
def upsert_entry(
    stage_id: int,
    day: date,
    body: DailyEntryIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    st = db.get(Stage, stage_id)
    if not st:
        raise HTTPException(404, "Etapa não encontrada")
    if body.day != day:
        raise HTTPException(400, "Data do corpo deve coincidir com a URL")

    row = db.scalar(select(DailyEntry).where(DailyEntry.stage_id == stage_id, DailyEntry.day == day))
    if row:
        row.planned_optimistic = body.planned_optimistic
        row.planned_pessimistic = body.planned_pessimistic
        row.executed = body.executed
        if body.execution_note is not None:
            row.execution_note = body.execution_note
    else:
        row = DailyEntry(
            stage_id=stage_id,
            day=day,
            planned_optimistic=body.planned_optimistic,
            planned_pessimistic=body.planned_pessimistic,
            executed=body.executed,
            execution_note=body.execution_note,
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.post("/api/projects/{project_id}/entries/bulk-planned")
def bulk_planned(
    project_id: int,
    body: BulkPlannedBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    stage_ids = set(db.scalars(select(Stage.id).where(Stage.project_id == project_id)).all())
    count = 0
    for item in body.entries:
        if item.stage_id not in stage_ids:
            raise HTTPException(400, f"Etapa {item.stage_id} não pertence ao projeto")
        row = db.scalar(
            select(DailyEntry).where(DailyEntry.stage_id == item.stage_id, DailyEntry.day == item.day)
        )
        if row:
            row.planned_optimistic = item.planned_optimistic
            row.planned_pessimistic = item.planned_pessimistic
        else:
            db.add(
                DailyEntry(
                    stage_id=item.stage_id,
                    day=item.day,
                    planned_optimistic=item.planned_optimistic,
                    planned_pessimistic=item.planned_pessimistic,
                    executed=0.0,
                    execution_note=None,
                )
            )
        count += 1
    db.commit()
    return {"upserted": count}


@app.post("/api/projects/{project_id}/entries/bulk-executed")
def bulk_executed(
    project_id: int,
    body: BulkExecutedBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    stage_ids = set(db.scalars(select(Stage.id).where(Stage.project_id == project_id)).all())
    count = 0
    for item in body.entries:
        if item.stage_id not in stage_ids:
            raise HTTPException(400, f"Etapa {item.stage_id} não pertence ao projeto")
        row = db.scalar(
            select(DailyEntry).where(DailyEntry.stage_id == item.stage_id, DailyEntry.day == item.day)
        )
        note = (item.execution_note or "").strip() or None
        if row:
            row.executed = item.executed
            row.execution_note = note
        else:
            db.add(
                DailyEntry(
                    stage_id=item.stage_id,
                    day=item.day,
                    planned_optimistic=0.0,
                    planned_pessimistic=0.0,
                    executed=item.executed,
                    execution_note=note,
                )
            )
        count += 1
    db.commit()
    return {"upserted": count}


# --- Painel financeiro (avanço produtivo: planejado × produzido) ---


@app.get("/api/projects/{project_id}/financial/dashboard", response_model=FinancialPanelDashboardOut)
def get_financial_dashboard(
    project_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    team_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    return build_financial_panel_dashboard(db, p, date_from, date_to, team_id)


@app.get("/api/projects/{project_id}/financial/export.xlsx")
def export_financial_xlsx(
    project_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    team_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    data, fname = financial_excel_bytes(db, p, date_from, date_to, team_id)
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@app.get("/api/projects/{project_id}/financial/physical-comparison", response_model=FinancialPhysicalComparisonOut)
def get_financial_physical_comparison(
    project_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.scalar(
        select(Project)
        .options(joinedload(Project.stages).joinedload(Stage.entries))
        .where(Project.id == project_id)
    )
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    return build_financial_physical_comparison(db, p, date_from, date_to)


@app.get("/api/projects/{project_id}/financial/physical-comparison/export.xlsx")
def export_financial_physical_comparison_xlsx(
    project_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    p = db.scalar(
        select(Project)
        .options(joinedload(Project.stages).joinedload(Stage.entries))
        .where(Project.id == project_id)
    )
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    data, fname = financial_physical_comparison_excel_bytes(db, p, date_from, date_to)
    return StreamingResponse(
        BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _financial_team_in_project(db: Session, project_id: int, team_id: int) -> FinancialTeam:
    t = db.get(FinancialTeam, team_id)
    if not t or t.project_id != project_id:
        raise HTTPException(404, "Equipe não encontrada")
    return t


@app.get("/api/projects/{project_id}/financial/teams", response_model=List[FinancialTeamOut])
def list_financial_teams(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    return db.scalars(
        select(FinancialTeam)
        .where(FinancialTeam.project_id == project_id)
        .order_by(FinancialTeam.name)
    ).all()


@app.post("/api/projects/{project_id}/financial/teams", response_model=FinancialTeamOut)
def create_financial_team(
    project_id: int,
    body: FinancialTeamIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    row = FinancialTeam(
        project_id=project_id,
        name=body.name.strip(),
        team_type=(body.team_type or "").strip(),
        uen=(body.uen or "").strip(),
        encarregado=(body.encarregado or "").strip(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.put("/api/projects/{project_id}/financial/teams/{team_id}", response_model=FinancialTeamOut)
def update_financial_team(
    project_id: int,
    team_id: int,
    body: FinancialTeamIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = _financial_team_in_project(db, project_id, team_id)
    row.name = body.name.strip()
    row.team_type = (body.team_type or "").strip()
    row.uen = (body.uen or "").strip()
    row.encarregado = (body.encarregado or "").strip()
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/projects/{project_id}/financial/teams/{team_id}")
def delete_financial_team(
    project_id: int,
    team_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = _financial_team_in_project(db, project_id, team_id)
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.get("/api/projects/{project_id}/financial/plans", response_model=List[FinancialDailyPlanOut])
def list_financial_plans(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    return db.scalars(
        select(FinancialDailyPlan)
        .options(selectinload(FinancialDailyPlan.team))
        .where(FinancialDailyPlan.project_id == project_id)
        .join(FinancialTeam, FinancialDailyPlan.team_id == FinancialTeam.id)
        .order_by(FinancialDailyPlan.day.desc(), FinancialTeam.name)
    ).all()


@app.post("/api/projects/{project_id}/financial/plans", response_model=FinancialDailyPlanOut)
def create_financial_plan(
    project_id: int,
    body: FinancialDailyPlanIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    _financial_team_in_project(db, project_id, body.team_id)
    dup = db.scalar(
        select(FinancialDailyPlan).where(
            FinancialDailyPlan.project_id == project_id,
            FinancialDailyPlan.day == body.day,
            FinancialDailyPlan.team_id == body.team_id,
        )
    )
    if dup:
        raise HTTPException(400, "Já existe planejamento para esta data e equipe")
    row = FinancialDailyPlan(
        project_id=project_id,
        day=body.day,
        team_id=body.team_id,
        daily_target_brl=body.daily_target_brl,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return db.scalars(
        select(FinancialDailyPlan)
        .options(selectinload(FinancialDailyPlan.team))
        .where(FinancialDailyPlan.id == row.id)
    ).first()


@app.put("/api/projects/{project_id}/financial/plans/{plan_id}", response_model=FinancialDailyPlanOut)
def update_financial_plan(
    project_id: int,
    plan_id: int,
    body: FinancialDailyPlanIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialDailyPlan, plan_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Planejamento não encontrado")
    _financial_team_in_project(db, project_id, body.team_id)
    clash = db.scalar(
        select(FinancialDailyPlan).where(
            FinancialDailyPlan.project_id == project_id,
            FinancialDailyPlan.day == body.day,
            FinancialDailyPlan.team_id == body.team_id,
            FinancialDailyPlan.id != plan_id,
        )
    )
    if clash:
        raise HTTPException(400, "Já existe planejamento para esta data e equipe")
    row.day = body.day
    row.team_id = body.team_id
    row.daily_target_brl = body.daily_target_brl
    db.commit()
    db.refresh(row)
    return db.scalars(
        select(FinancialDailyPlan)
        .options(selectinload(FinancialDailyPlan.team))
        .where(FinancialDailyPlan.id == row.id)
    ).first()


@app.delete("/api/projects/{project_id}/financial/plans/{plan_id}")
def delete_financial_plan(
    project_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialDailyPlan, plan_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Planejamento não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


@app.get("/api/projects/{project_id}/financial/production", response_model=List[FinancialDailyProductionOut])
def list_financial_production(
    project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    return db.scalars(
        select(FinancialDailyProduction)
        .options(selectinload(FinancialDailyProduction.team))
        .where(FinancialDailyProduction.project_id == project_id)
        .join(FinancialTeam, FinancialDailyProduction.team_id == FinancialTeam.id)
        .order_by(FinancialDailyProduction.day.desc(), FinancialTeam.name)
    ).all()


@app.post("/api/projects/{project_id}/financial/production", response_model=FinancialDailyProductionOut)
def create_financial_production(
    project_id: int,
    body: FinancialDailyProductionIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    _financial_team_in_project(db, project_id, body.team_id)
    dup = db.scalar(
        select(FinancialDailyProduction).where(
            FinancialDailyProduction.project_id == project_id,
            FinancialDailyProduction.day == body.day,
            FinancialDailyProduction.team_id == body.team_id,
        )
    )
    if dup:
        raise HTTPException(400, "Já existe lançamento de produção para esta data e equipe")
    row = FinancialDailyProduction(
        project_id=project_id,
        day=body.day,
        team_id=body.team_id,
        produced_value_brl=body.produced_value_brl,
        observation=(body.observation or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return db.scalars(
        select(FinancialDailyProduction)
        .options(selectinload(FinancialDailyProduction.team))
        .where(FinancialDailyProduction.id == row.id)
    ).first()


@app.put("/api/projects/{project_id}/financial/production/{prod_id}", response_model=FinancialDailyProductionOut)
def update_financial_production(
    project_id: int,
    prod_id: int,
    body: FinancialDailyProductionIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialDailyProduction, prod_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Lançamento não encontrado")
    _financial_team_in_project(db, project_id, body.team_id)
    clash = db.scalar(
        select(FinancialDailyProduction).where(
            FinancialDailyProduction.project_id == project_id,
            FinancialDailyProduction.day == body.day,
            FinancialDailyProduction.team_id == body.team_id,
            FinancialDailyProduction.id != prod_id,
        )
    )
    if clash:
        raise HTTPException(400, "Já existe lançamento de produção para esta data e equipe")
    row.day = body.day
    row.team_id = body.team_id
    row.produced_value_brl = body.produced_value_brl
    row.observation = (body.observation or "").strip() or None
    db.commit()
    db.refresh(row)
    return db.scalars(
        select(FinancialDailyProduction)
        .options(selectinload(FinancialDailyProduction.team))
        .where(FinancialDailyProduction.id == row.id)
    ).first()


@app.delete("/api/projects/{project_id}/financial/production/{prod_id}")
def delete_financial_production(
    project_id: int,
    prod_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialDailyProduction, prod_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Lançamento não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


# --- Lançamentos detalhados (planilha UPS / mão de obra) ---


@app.get("/api/projects/{project_id}/financial/entries", response_model=List[FinancialEntryOut])
def list_financial_entries(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    rows = db.scalars(
        select(FinancialProductionEntry)
        .where(FinancialProductionEntry.project_id == project_id)
        .order_by(FinancialProductionEntry.exec_date.desc(), FinancialProductionEntry.id.desc())
    ).all()
    return rows


@app.post("/api/projects/{project_id}/financial/entries", response_model=FinancialEntryOut)
def create_financial_entry(
    project_id: int,
    body: FinancialEntryIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if not db.get(Project, project_id):
        raise HTTPException(404, "Projeto não encontrado")
    row = FinancialProductionEntry(
        project_id=project_id,
        exec_date=body.exec_date,
        team_type=body.team_type.strip(),
        segment=body.segment.strip(),
        uen=body.uen.strip(),
        obra_code=body.obra_code.strip(),
        labor_code=body.labor_code.strip(),
        description=body.description.strip(),
        quantity=body.quantity,
        ups=body.ups,
        ups_brl=body.ups_brl,
        value_brl=body.value_brl,
        ep_note=(body.ep_note or "").strip() or None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.put("/api/projects/{project_id}/financial/entries/{entry_id}", response_model=FinancialEntryOut)
def update_financial_entry(
    project_id: int,
    entry_id: int,
    body: FinancialEntryIn,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialProductionEntry, entry_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Lançamento não encontrado")
    row.exec_date = body.exec_date
    row.team_type = body.team_type.strip()
    row.segment = body.segment.strip()
    row.uen = body.uen.strip()
    row.obra_code = body.obra_code.strip()
    row.labor_code = body.labor_code.strip()
    row.description = body.description.strip()
    row.quantity = body.quantity
    row.ups = body.ups
    row.ups_brl = body.ups_brl
    row.value_brl = body.value_brl
    row.ep_note = (body.ep_note or "").strip() or None
    db.commit()
    db.refresh(row)
    return row


@app.delete("/api/projects/{project_id}/financial/entries/{entry_id}")
def delete_financial_entry(
    project_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    row = db.get(FinancialProductionEntry, entry_id)
    if not row or row.project_id != project_id:
        raise HTTPException(404, "Lançamento não encontrado")
    db.delete(row)
    db.commit()
    return {"ok": True}


# --- Painel ---


@app.get("/api/projects/{project_id}/dashboard", response_model=DashboardOut)
def get_dashboard(project_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.scalar(
        select(Project)
        .options(joinedload(Project.stages).joinedload(Stage.entries))
        .where(Project.id == project_id)
    )
    if not p:
        raise HTTPException(404, "Projeto não encontrado")
    data = build_dashboard(p)
    return DashboardOut.model_validate(data)


if _FRONTEND_DIST.is_dir():

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(404, detail="Not found")
        candidate = _FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_DIST / "index.html")
