from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from typing import Dict, Any
import libsql_client

from app.core.config import settings
from app.core.database import get_db
from app.schemas.auth import (
    LoginRequest,
    UserResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    AuthMessageResponse,
)
from app.services import auth_service
from app.services.auth_service import AuthError
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

@router.post("/login", response_model=UserResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: libsql_client.Client = Depends(get_db)
):
    """
    Inicia sesión, aplica protección contra fuerza bruta y genera una cookie HttpOnly segura.
    """
    user_agent = request.headers.get("User-Agent")
    client_ip = get_client_ip(request)

    try:
        user, raw_token = await auth_service.login_user(
            client=db,
            email=payload.email,
            password=payload.password,
            user_agent=user_agent,
            ip_address=client_ip
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Configurar cookie de sesión HttpOnly
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "production"),
        max_age=settings.SESSION_EXPIRE_HOURS * 3600,
        path="/"
    )

    return user

@router.post("/logout", response_model=AuthMessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: libsql_client.Client = Depends(get_db)
):
    """
    Cierra la sesión activa, la invalida en la base de datos y destruye la cookie.
    """
    session_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]

    if session_token:
        await auth_service.logout_user(db, session_token)

    response.delete_cookie(
        key=settings.SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax"
    )

    return AuthMessageResponse(message="Sesión cerrada correctamente", success=True)

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retorna la información del usuario actualmente autenticado.
    """
    return current_user

@router.post("/forgot-password", response_model=AuthMessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: libsql_client.Client = Depends(get_db)
):
    """
    Solicita un enlace de recuperación de contraseña enviado por correo.
    Siempre retorna un mensaje genérico para no filtrar la existencia de cuentas.
    """
    await auth_service.request_password_reset(db, payload.email)
    return AuthMessageResponse(
        message="Si el correo electrónico está registrado, recibirá las instrucciones para restablecer su contraseña.",
        success=True
    )

@router.post("/reset-password", response_model=AuthMessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: libsql_client.Client = Depends(get_db)
):
    """
    Restablece la contraseña utilizando el token temporal de 30 minutos.
    """
    try:
        await auth_service.reset_password_with_token(db, payload.token, payload.new_password)
        return AuthMessageResponse(
            message="Contraseña restablecida con éxito. Ya puede iniciar sesión con su nueva clave.",
            success=True
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.post("/change-password", response_model=AuthMessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Modifica la contraseña del usuario con sesión activa requiriendo la clave actual.
    """
    try:
        await auth_service.change_user_password(
            client=db,
            user_id=current_user["id"],
            current_password=payload.current_password,
            new_password=payload.new_password
        )
        return AuthMessageResponse(
            message="Contraseña actualizada exitosamente.",
            success=True
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
