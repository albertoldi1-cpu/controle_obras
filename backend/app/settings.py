"""Configuração central (ambiente, CORS, checagens de produção)."""
import os
from pathlib import Path
from typing import Optional


def _truthy(v: Optional[str]) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes")


def is_production() -> bool:
    return _truthy(os.getenv("RENDER")) or os.getenv("ENVIRONMENT", "").strip().lower() == "production"


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    if is_production():
        ext = os.getenv("RENDER_EXTERNAL_URL", "").strip().rstrip("/")
        if ext:
            return [ext]
    return ["*"]


def docs_enabled() -> bool:
    if _truthy(os.getenv("FORCE_API_DOCS")):
        return True
    if _truthy(os.getenv("DISABLE_API_DOCS")):
        return False
    return not is_production()


def dev_secret_key() -> str:
    return "dev-secret-change-in-production"


def get_secret_key() -> str:
    """JWT: SECRET_KEY, JWT_SECRET ou arquivo SECRET_KEY_FILE (Render / Docker)."""
    sk = os.getenv("SECRET_KEY", "").strip()
    if sk:
        return sk
    alt = os.getenv("JWT_SECRET", "").strip()
    if alt:
        return alt
    path = os.getenv("SECRET_KEY_FILE", "").strip()
    if path:
        p = Path(path)
        if p.is_file():
            return p.read_text().strip()
    return ""


def validate_production_security() -> None:
    if not is_production():
        return
    sk = get_secret_key()
    if len(sk) < 32 or sk == dev_secret_key():
        raise RuntimeError(
            "Render/produção: falta uma chave segura para JWT. No painel do serviço → "
            "Environment, adicione SECRET_KEY (ou JWT_SECRET) com pelo menos 32 caracteres. "
            "Gere no Mac/Linux: openssl rand -hex 32 — copie e cole o valor. "
            "Defina também MASTER_PASSWORD (senha do master)."
        )
    if not os.getenv("MASTER_PASSWORD", "").strip():
        raise RuntimeError(
            "Render/produção: defina MASTER_PASSWORD no Environment (senha forte do usuário master)."
        )
