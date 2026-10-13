import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

# Resolver la ruta hacia el archivo .env en la raíz del repositorio
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BASE_DIR.parent
ENV_FILE = ROOT_DIR / ".env" if (ROOT_DIR / ".env").exists() else BASE_DIR / ".env"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "Mercería CRM"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    
    # Base de datos Turso
    TURSO_DATABASE_URL: str = Field(
        default="",
        description="URL de la base de datos Turso (libsql://...)"
    )
    TURSO_AUTH_TOKEN: str = Field(
        default="",
        description="Token de autenticación secreto de Turso"
    )

    # Seguridad y Sesiones
    SECRET_KEY: str = Field(
        default="desarrollo_inseguro_reemplazar_con_clave_secreta_en_produccion",
        description="Clave criptográfica para firmas de sesión"
    )
    SESSION_EXPIRE_HOURS: int = 12
    SESSION_COOKIE_NAME: str = "merceria_session"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Localización y Negocio
    BUSINESS_TIMEZONE: str = "America/Argentina/Tucuman"
    BUSINESS_CURRENCY: str = "ARS"

    # Correo
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "notificaciones@trazos.local"
    FRONTEND_URL: str = "http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

settings = Settings()
