"""Limite simples de taxa por IP (memória; adequado a instância única)."""
import time
from collections import defaultdict, deque

_WINDOW_SEC = 300
_MAX_ATTEMPTS = 25

_attempts: dict[str, deque[float]] = defaultdict(deque)


def register_login_attempt(client_ip: str) -> None:
    now = time.time()
    q = _attempts[client_ip]
    while q and now - q[0] > _WINDOW_SEC:
        q.popleft()
    q.append(now)


def login_rate_limited(client_ip: str) -> bool:
    now = time.time()
    q = _attempts[client_ip]
    while q and now - q[0] > _WINDOW_SEC:
        q.popleft()
    return len(q) >= _MAX_ATTEMPTS
