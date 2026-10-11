from typing import Optional, Dict, Any
from fastapi import Request, Depends, HTTPException, status
import libsql_client

from app.core.config import settings
from app.core.database import get_db
from app.services import auth_service

async def get_optional_user(
    request: Request,
    db: libsql_client.Client = Depends(get_db)
) -> Optional[Dict[str, Any]]:
    """
    Obtiene el usuario autenticado si la cookie de sesión está presente y es válida.
    """
    session_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not session_token:
        # Fallback a cabecera Authorization: Bearer <token> si se utiliza API
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
            
    if not session_token:
        return None

    return await auth_service.get_current_user_from_token(db, session_token)

async def get_current_user(
    user: Optional[Dict[str, Any]] = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Dependencia estricta para rutas protegidas. Lanza 401 si no hay sesión activa.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada o no autorizada. Por favor inicie sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
