from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal

ALLOWED_UNITS = ("unidad", "metro", "paquete", "rollo", "centimetro", "gramo")
FRACTIONAL_DEFAULT_UNITS = ("metro", "centimetro", "gramo")

class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50, description="Código interno o SKU único")
    name: str = Field(..., min_length=1, max_length=150, description="Nombre comercial del producto")
    category_id: Optional[str] = Field(None, description="ID de la categoría asociada")
    description: Optional[str] = Field(None, max_length=500, description="Descripción opcional")
    cost_cents: int = Field(..., ge=0, description="Costo unitario de compra en centavos (ej: 1000 = $10.00)")
    price_cents: int = Field(..., ge=0, description="Precio de venta habitual en centavos")
    current_stock: float = Field(default=0.0, ge=0.0, description="Cantidad de stock disponible actual")
    min_stock: float = Field(default=0.0, ge=0.0, description="Stock mínimo para alerta de reposición")
    unit_of_measure: str = Field(default="unidad", description="Unidad de medida")
    is_fractional: bool = Field(default=False, description="True si permite cantidades fraccionadas (ej: metros)")

    @field_validator("sku")
    @classmethod
    def clean_sku(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not cleaned:
            raise ValueError("El SKU o código de producto no puede estar vacío")
        return cleaned

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El nombre del producto no puede estar vacío")
        return cleaned

    @field_validator("unit_of_measure")
    @classmethod
    def validate_unit(cls, v: str) -> str:
        unit = v.strip().lower()
        if unit not in ALLOWED_UNITS:
            raise ValueError(f"Unidad de medida inválida. Permitidas: {', '.join(ALLOWED_UNITS)}")
        return unit

    @field_validator("current_stock", "min_stock")
    @classmethod
    def round_stock_precision(cls, v: float) -> float:
        return round(float(v), 3)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    category_id: Optional[str] = None
    description: Optional[str] = None
    cost_cents: Optional[int] = Field(None, ge=0)
    price_cents: Optional[int] = Field(None, ge=0)
    current_stock: Optional[float] = Field(None, ge=0.0)
    min_stock: Optional[float] = Field(None, ge=0.0)
    unit_of_measure: Optional[str] = None
    is_fractional: Optional[bool] = None

    @field_validator("sku")
    @classmethod
    def clean_sku(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip().upper()
            if not cleaned:
                raise ValueError("El SKU no puede estar vacío")
            return cleaned
        return None

    @field_validator("unit_of_measure")
    @classmethod
    def validate_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            unit = v.strip().lower()
            if unit not in ALLOWED_UNITS:
                raise ValueError(f"Unidad inválida. Permitidas: {', '.join(ALLOWED_UNITS)}")
            return unit
        return None

class ProductResponse(ProductBase):
    id: str
    category_name: Optional[str] = None
    is_active: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}

class ProductStatusUpdate(BaseModel):
    is_active: bool

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
