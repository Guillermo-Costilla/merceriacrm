from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
import zoneinfo

from app.core.config import settings
from app.core.database import check_database_health
from app.api.v1 import api_v1_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="API de Gestión de Inventario y Ventas para Mercería",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

app.include_router(api_v1_router)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware de Cabeceras de Seguridad
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

@app.get("/api/health", tags=["Salud"])
async def health_check():
    """
    Endpoint de comprobación del estado del servicio backend y conexión a base de datos.
    """
    now_utc = datetime.now(timezone.utc)
    try:
        tucuman_tz = zoneinfo.ZoneInfo(settings.BUSINESS_TIMEZONE)
        now_tucuman = now_utc.astimezone(tucuman_tz).isoformat()
    except Exception:
        now_tucuman = now_utc.isoformat()

    has_turso_url = bool(settings.TURSO_DATABASE_URL)
    has_turso_token = bool(settings.TURSO_AUTH_TOKEN)

    db_health = {"connected": False, "latency_ms": None, "error": "Credenciales no configuradas"}
    if has_turso_url and has_turso_token:
        db_health = await check_database_health()

    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp_utc": now_utc.isoformat(),
        "timestamp_local": now_tucuman,
        "timezone": settings.BUSINESS_TIMEZONE,
        "turso_configured": has_turso_url and has_turso_token,
        "database": db_health,
    }
