from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
import libsql_client

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.inventory import (
    InventoryMovementCreate,
    InventoryMovementResponse,
    InventoryMovementListResponse,
    InventoryReconciliationReport
)
from app.services import inventory_service
from app.services.inventory_service import InventoryError
from app.repositories import inventory_repo

router = APIRouter(prefix="/inventory", tags=["Inventario"])

@router.get("/movements", response_model=InventoryMovementListResponse)
async def list_inventory_movements(
    product_id: Optional[str] = Query(None, description="Filtrar movimientos por ID de producto"),
    movement_type: Optional[str] = Query(None, description="Filtrar por tipo de movimiento"),
    search: Optional[str] = Query(None, description="Búsqueda por nombre de producto, SKU o motivo"),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(25, ge=1, le=100, description="Elementos por página"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Lista el historial cronológico de movimientos de stock con filtros y paginación.
    """
    offset = (page - 1) * page_size
    items, total = await inventory_repo.list_movements(
        client=db,
        business_id=current_user["business_id"],
        product_id=product_id,
        movement_type=movement_type,
        search=search,
        limit=page_size,
        offset=offset
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return InventoryMovementListResponse(
        items=items, # type: ignore
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("/movements", response_model=InventoryMovementResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_movement(
    payload: InventoryMovementCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Registra un movimiento manual de inventario (Entrada de compra, Ajuste positivo o Ajuste negativo).
    Actualiza atómicamente el stock del producto e impide saldos negativos.
    """
    try:
        movement = await inventory_service.record_manual_movement(
            client=db,
            data=payload,
            business_id=current_user["business_id"],
            user_id=current_user["id"]
        )
        return movement
    except InventoryError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/reconciliation", response_model=InventoryReconciliationReport)
async def get_inventory_reconciliation(
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Ejecuta un informe de reconciliación comparando el stock actual de cada producto
    con la reconstrucción matemática de todos sus movimientos históricos.
    """
    return await inventory_service.get_reconciliation_report(db, current_user["business_id"])
