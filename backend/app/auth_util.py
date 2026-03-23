"""Credenciais padrão do master (uma única fonte para bootstrap e script de reset)."""
import os

DEFAULT_MASTER_USERNAME = "Andre"
DEFAULT_MASTER_PASSWORD = "Eng@3112"


def master_username() -> str:
    return os.getenv("MASTER_USERNAME", DEFAULT_MASTER_USERNAME).strip() or DEFAULT_MASTER_USERNAME


def master_password() -> str:
    p = os.getenv("MASTER_PASSWORD", DEFAULT_MASTER_PASSWORD)
    if len(p) < 4:
        return DEFAULT_MASTER_PASSWORD
    return p
