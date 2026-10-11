import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.core.config import settings

# Instancia de Argon2id configurada con parámetros robustos
password_hasher = PasswordHasher(
    time_cost=3,        # 3 iteraciones
    memory_cost=65536,  # 64 MB de memoria
    parallelism=4,      # 4 hilos paralelos
    hash_len=32,
    salt_len=16
)

def hash_password(password: str) -> str:
    """
    Genera un hash seguro con sal aleatoria criptográfica utilizando Argon2id.
    """
    return password_hasher.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica una contraseña en texto plano contra el hash almacenado.
    """
    try:
        return password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False

def generate_secure_token(nbytes: int = 32) -> str:
    """
    Genera un token seguro criptográficamente para sesiones o recuperación.
    """
    return secrets.token_urlsafe(nbytes)

def hash_token(raw_token: str) -> str:
    """
    Calcula el hash SHA-256 de un token para almacenar en base de datos.
    De esta forma, si la base de datos se filtra, los tokens reales siguen protegidos.
    """
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

def get_session_expiry() -> str:
    """
    Calcula la fecha de caducidad en formato ISO8601 UTC para una nueva sesión.
    """
    expires = datetime.now(timezone.utc) + timedelta(hours=settings.SESSION_EXPIRE_HOURS)
    return expires.isoformat()

def get_password_reset_expiry() -> str:
    """
    Calcula la fecha de caducidad de 30 minutos para un token de recuperación.
    """
    expires = datetime.now(timezone.utc) + timedelta(minutes=30)
    return expires.isoformat()

def is_expired(iso_timestamp: str) -> bool:
    """
    Verifica si una marca temporal ISO8601 ya expiró respecto a la hora actual UTC.
    """
    try:
        expiry_dt = datetime.fromisoformat(iso_timestamp)
        now_dt = datetime.now(timezone.utc)
        return now_dt > expiry_dt
    except Exception:
        return True
