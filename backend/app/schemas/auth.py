from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=100)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Contraseña de al menos 8 caracteres")

class UserResponse(UserBase):
    id: str
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
