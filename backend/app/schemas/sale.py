from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal

class SaleItemCreate(BaseModel):
    product_id: str = Field(..., description="ID del producto a vender")
    quantity: float = Field(..., gt=0, description="Cantidad a vender (mayor a 0)")
    unit_price_cents: Optional[int] = Field(None, ge=0, description="Precio unitario aplicado (si no se envía, toma el del catálogo)")

    @field_validator("quantity")
    @classmethod
    def round_qty(cls, v: float) -> float:
        return round(float(v), 3)

class SaleCreate(BaseModel):
    items: List[SaleItemCreate] = Field(..., min_length=1, description="Al menos una línea de producto requerida")
    notes: Optional[str] = Field(None, max_length=500, description="Observaciones opcionales")
    idempotency_key: Optional[str] = Field(None, description="Clave única para evitar ventas duplicadas por doble clic")

class SaleCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., min_length=5, max_length=255, description="Motivo obligatorio de la anulación")

    @field_validator("cancellation_reason")
    @classmethod
    def clean_reason(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("El motivo de anulación debe contener al menos 5 caracteres.")
        return cleaned

class SaleItemResponse(BaseModel):
    id: str
    sale_id: str
    product_id: str
    product_name: str
    product_sku: str
    unit_of_measure: str
    quantity: float
    unit_price_cents: int
    unit_cost_cents: int
    subtotal_cents: int
    estimated_gross_profit_cents: int

    model_config = {"from_attributes": True}

class SaleResponse(BaseModel):
    id: str
    sale_number: int
    sale_date: str
    total_cents: int
    total_cost_cents: int
    estimated_gross_profit_cents: int
    status: Literal['COMPLETED', 'CANCELLED']
    cancellation_reason: Optional[str] = None
    cancelled_at: Optional[str] = None
    notes: Optional[str] = None
    idempotency_key: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_by_user_name: Optional[str] = None
    created_at: str
    items: List[SaleItemResponse] = []

    model_config = {"from_attributes": True}

class SaleListResponse(BaseModel):
    items: List[SaleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
