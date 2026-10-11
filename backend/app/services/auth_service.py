import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple
import libsql_client

from app.core import security
from app.core.config import settings
from app.repositories import auth_repo

# Dummy hash para mitigar ataques de tiempo si el correo no existe
DUMMY_HASH = security.hash_password("dummy_password_timing_mitigation")

class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)

async def create_initial_admin(
    client: libsql_client.Client,
    email: str,
    password: str,
    full_name: str
) -> Dict[str, Any]:
    """
    Crea el usuario administrador inicial.
    """
    existing_user = await auth_repo.get_user_by_email(client, email)
    if existing_user:
        raise AuthError("Ya existe un usuario registrado con este correo electrónico", status_code=409)

    user_id = str(uuid.uuid4())
    pw_hash = security.hash_password(password)
    user = await auth_repo.create_user(
        client=client,
        user_id=user_id,
        email=email,
        password_hash=pw_hash,
        full_name=full_name
    )
    return user

async def login_user(
    client: libsql_client.Client,
    email: str,
    password: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None
) -> Tuple[Dict[str, Any], str]:
    """
    Autentica al usuario aplicando protección contra fuerza bruta y genera una sesión.
    Retorna (datos_usuario, raw_session_token).
    """
    user = await auth_repo.get_user_by_email(client, email)
    
    # 1. Mitigación de enumeración por tiempo si el usuario no existe
    if not user:
        security.verify_password(password, DUMMY_HASH)
        raise AuthError("Credenciales inválidas", status_code=401)

    # 2. Verificar si la cuenta está desactivada
    if not user.get("is_active"):
        raise AuthError("Esta cuenta ha sido desactivada. Comuníquese con el administrador.", status_code=403)

    # 3. Comprobación de bloqueo por intentos fallidos (Brute Force Protection)
    locked_until = user.get("locked_until")
    if locked_until:
        try:
            locked_dt = datetime.fromisoformat(locked_until)
            now_dt = datetime.now(timezone.utc)
            if now_dt < locked_dt:
                diff_minutes = max(1, int((locked_dt - now_dt).total_seconds() / 60))
                raise AuthError(
                    f"Demasiados intentos fallidos. Cuenta bloqueada temporalmente. Reintente en {diff_minutes} minuto(s).",
                    status_code=429
                )
        except AuthError:
            raise
        except Exception:
            pass

    # 4. Verificación de contraseña con Argon2id
    is_valid = security.verify_password(password, user["password_hash"])
    if not is_valid:
        current_attempts = (user.get("failed_login_attempts") or 0) + 1
        new_locked_until = None
        if current_attempts >= 5:
            # Bloquear por 15 minutos al quinto intento fallido consecutivo
            lock_time = datetime.now(timezone.utc) + timedelta(minutes=15)
            new_locked_until = lock_time.isoformat()
            
        await auth_repo.update_failed_login(client, user["id"], current_attempts, new_locked_until)
        
        if new_locked_until:
            raise AuthError(
                "Demasiados intentos fallidos. Su cuenta ha sido bloqueada temporalmente por 15 minutos.",
                status_code=429
            )
        raise AuthError("Credenciales inválidas", status_code=401)

    # 5. Restablecer contador de fallos tras inicio de sesión exitoso
    if user.get("failed_login_attempts") or user.get("locked_until"):
        await auth_repo.reset_failed_login(client, user["id"])

    # 6. Generar nueva sesión segura
    raw_token = security.generate_secure_token(32)
    token_hash = security.hash_token(raw_token)
    session_id = str(uuid.uuid4())
    expires_at = security.get_session_expiry()

    await auth_repo.create_session(
        client=client,
        session_id=session_id,
        user_id=user["id"],
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address
    )

    return user, raw_token

async def get_current_user_from_token(
    client: libsql_client.Client,
    raw_token: str
) -> Optional[Dict[str, Any]]:
    """
    Obtiene y valida el usuario activo a partir del token de sesión.
    """
    if not raw_token:
        return None

    token_hash = security.hash_token(raw_token)
    session = await auth_repo.get_session_with_user(client, token_hash)
    if not session:
        return None

    # Verificar caducidad
    if security.is_expired(session["expires_at"]):
        await auth_repo.delete_session(client, token_hash)
        return None

    if not session.get("is_active"):
        return None

    return {
        "id": session["user_id"],
        "email": session["email"],
        "full_name": session["full_name"],
        "is_active": bool(session["is_active"]),
        "created_at": session["created_at"]
    }

async def logout_user(client: libsql_client.Client, raw_token: str) -> None:
    if raw_token:
        token_hash = security.hash_token(raw_token)
        await auth_repo.delete_session(client, token_hash)

async def request_password_reset(
    client: libsql_client.Client,
    email: str
) -> Tuple[bool, Optional[str]]:
    """
    Genera un token de recuperación. Retorna (enviado, token_para_debug_o_email).
    """
    user = await auth_repo.get_user_by_email(client, email)
    if not user or not user.get("is_active"):
        # Retorna éxito aparente para evitar enumeración de usuarios
        return True, None

    raw_token = security.generate_secure_token(32)
    token_hash = security.hash_token(raw_token)
    token_id = str(uuid.uuid4())
    expires_at = security.get_password_reset_expiry()

    await auth_repo.create_password_reset_token(
        client=client,
        token_id=token_id,
        user_id=user["id"],
        token_hash=token_hash,
        expires_at=expires_at
    )

    reset_url = f"{settings.FRONTEND_URL}/recuperar-clave?token={raw_token}"
    
    # Si no hay SMTP configurado y estamos en desarrollo, imprimir en consola de forma segura
    if not settings.SMTP_HOST and settings.ENVIRONMENT == "development":
        print(f"\x1b[33m[Dev Auth] Enlace de recuperación generado para {email}:\x1b[0m")
        print(f"\x1b[36m{reset_url}\x1b[0m")

    return True, raw_token

async def reset_password_with_token(
    client: libsql_client.Client,
    raw_token: str,
    new_password: str
) -> None:
    token_hash = security.hash_token(raw_token)
    token_record = await auth_repo.get_password_reset_token(client, token_hash)
    
    if not token_record:
        raise AuthError("El enlace de recuperación es inválido o ya fue utilizado", status_code=400)

    if token_record.get("used_at"):
        raise AuthError("Este enlace de recuperación ya ha sido consumido", status_code=400)

    if security.is_expired(token_record["expires_at"]):
        raise AuthError("El enlace de recuperación ha expirado", status_code=400)

    user_id = token_record["user_id"]
    new_hash = security.hash_password(new_password)

    # Actualizar contraseña, marcar token como consumido e invalidar todas las sesiones previas
    await auth_repo.update_user_password(client, user_id, new_hash)
    await auth_repo.mark_password_reset_token_used(client, token_record["id"])
    await auth_repo.delete_all_user_sessions(client, user_id)

async def change_user_password(
    client: libsql_client.Client,
    user_id: str,
    current_password: str,
    new_password: str
) -> None:
    user = await auth_repo.get_user_by_id(client, user_id)
    if not user:
        raise AuthError("Usuario no encontrado", status_code=404)

    if not security.verify_password(current_password, user["password_hash"]):
        raise AuthError("La contraseña actual es incorrecta", status_code=400)

    new_hash = security.hash_password(new_password)
    await auth_repo.update_user_password(client, user_id, new_hash)
