import time
from typing import Any, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.settings import dev_secret_key, get_secret_key

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7


def _jwt_signing_key() -> str:
    k = get_secret_key()
    return k if k else dev_secret_key()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, username: str, is_master: bool) -> str:
    exp = int(time.time()) + ACCESS_TOKEN_EXPIRE_DAYS * 86400
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "username": username,
        "m": is_master,
        "exp": exp,
    }
    return jwt.encode(payload, _jwt_signing_key(), algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, _jwt_signing_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None
