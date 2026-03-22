from typing import Optional

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_core import decode_token
from app.database import get_db
from app.models import User

security = HTTPBearer(auto_error=False)


def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not cred or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Não autenticado", headers={"WWW-Authenticate": "Bearer"})
    data = decode_token(cred.credentials)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    uid = int(data["sub"])
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuário inválido ou inativo")
    return user


def require_master(user: User = Depends(get_current_user)) -> User:
    if not user.is_master:
        raise HTTPException(status_code=403, detail="Apenas o administrador master pode executar esta ação")
    return user
