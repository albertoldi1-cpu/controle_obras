#!/usr/bin/env python3
"""
Remove TODOS os usuários e cria de novo o master com as credenciais padrão
(ou MASTER_USERNAME / MASTER_PASSWORD no ambiente).

Use quando não conseguir logar após mudar senha no código ou se o banco ainda
tiver o usuário antigo (ex.: admin).

  cd obra-controle-web
  python3 scripts/reset_master.py

Com PostgreSQL:
  export DATABASE_URL="postgresql+psycopg2://..."
  python3 scripts/reset_master.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from passlib.context import CryptContext
from sqlalchemy import delete

from app.auth_util import master_password, master_username
from app.database import SessionLocal, init_db
from app.models import User

# Mesmo algoritmo que app.auth_core (evita importar jose neste script).
_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main() -> None:
    init_db()
    u = master_username()
    p = master_password()
    db = SessionLocal()
    try:
        db.execute(delete(User))
        db.commit()
        db.add(
            User(
                username=u,
                password_hash=_pwd.hash(p),
                is_master=True,
                is_active=True,
            )
        )
        db.commit()
        print(f"OK — usuário master recriado.")
        print(f"    Login: {u}")
        print(f"    Senha: {p}")
        print("    (Outros usuários foram removidos.)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
