"""Configuração central (ambiente, CORS, checagens de produção)."""
import os
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


def validate_production_security() -> None:
    if not is_production():
        return
    sk = os.getenv("SECRET_KEY", "").strip()
    if len(sk) < 32 or sk == dev_secret_key():
        raise RuntimeError(
            "Produção: defina SECRET_KEY com pelo menos 32 caracteres aleatórios "
            "(variável de ambiente no Render)."
        )
    if not os.getenv("MASTER_PASSWORD", "").strip():
        raise RuntimeError(
            "Produção: defina MASTER_PASSWORD nas variáveis de ambiente "
            "(não use apenas o padrão do código)."
        )
