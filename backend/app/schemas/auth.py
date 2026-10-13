from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import base64
import binascii

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("El nombre debe tener al menos 2 caracteres")
        return normalized

class RegisterRequest(UserBase):
    business_name: str = Field(..., min_length=2, max_length=100)
    business_logo_data_url: Optional[str] = Field(default=None, max_length=700_000)
    password: str = Field(..., min_length=8, description="Contraseña de al menos 8 caracteres")

    @field_validator("business_name")
    @classmethod
    def normalize_business_name(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("El nombre del comercio debe tener al menos 2 caracteres")
        return normalized

    @field_validator("business_logo_data_url")
    @classmethod
    def validate_business_logo(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        header, separator, encoded = value.partition(",")
        media_type = header.removeprefix("data:").removesuffix(";base64")
        if not separator or header != f"data:{media_type};base64" or media_type not in {
            "image/png",
            "image/jpeg",
            "image/webp",
        }:
            raise ValueError("El logo debe ser PNG, JPG o WEBP.")

        try:
            image = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("El archivo del logo no es válido.") from None

        valid_signatures = {
            "image/png": image.startswith(b"\x89PNG\r\n\x1a\n"),
            "image/jpeg": image.startswith(b"\xff\xd8\xff"),
            "image/webp": image.startswith(b"RIFF") and image[8:12] == b"WEBP",
        }
        if not valid_signatures[media_type]:
            raise ValueError("El contenido del logo no coincide con su formato.")
        if len(image) > 512 * 1024:
            raise ValueError("El logo no puede superar los 512 KB.")
        return value

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Contraseña de al menos 8 caracteres")

class UserResponse(UserBase):
    id: str
    business_id: str
    business_name: str
    business_logo_data_url: Optional[str] = None
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="La nueva contraseña debe tener al menos 8 caracteres")

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, description="Token de recuperación recibido")
    new_password: str = Field(..., min_length=8, description="La nueva contraseña debe tener al menos 8 caracteres")

class AuthMessageResponse(BaseModel):
    message: str
    success: bool = True
