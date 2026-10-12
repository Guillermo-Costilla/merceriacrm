from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal

MovementType = Literal[
    'PURCHASE_ENTRY',
    'SALE_EXIT',
    'SALE_REVERSION',
    'ADJUSTMENT_POSITIVE',
    'ADJUSTMENT_NEGATIVE'
]

class InventoryMovementCreate(BaseModel):
    product_id: str = Field(..., description="ID del producto a modificar")
    movement_type: Literal['PURCHASE_ENTRY', 'ADJUSTMENT_POSITIVE', 'ADJUSTMENT_NEGATIVE'] = Field(
        ...,
        description="Tipo de operación manual: Entrada de compra, Ajuste positivo o Ajuste negativo"
    )
    quantity: float = Field(..., gt=0, description="Cantidad a ingresar o ajustar (debe ser mayor a 0)")
    reason: str = Field(..., min_length=3, max_length=255, description="Motivo obligatorio de la operación")

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 3:
            raise ValueError("El motivo debe tener al menos 3 caracteres.")
        return cleaned

    @field_validator("quantity")
    @classmethod
    def round_qty(cls, v: float) -> float:
        return round(float(v), 3)

class InventoryMovementResponse(BaseModel):
    id: str
    product_id: str
    product_name: str
    product_sku: str
    unit_of_measure: str
    movement_type: str
    quantity: float
    previous_stock: float
    resulting_stock: float
    reason: str
    reference_sale_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    created_by_user_name: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}

class InventoryMovementListResponse(BaseModel):
    items: List[InventoryMovementResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class InventoryReconciliationItem(BaseModel):
    product_id: str
    product_name: str
    sku: str
    unit_of_measure: str
    current_stock: float
    calculated_stock: float
    is_consistent: bool
    difference: float

class InventoryReconciliationReport(BaseModel):
    total_products_checked: int
    consistent_count: int
    discrepancy_count: int
    is_fully_consistent: bool
    items: List[InventoryReconciliationItem]
