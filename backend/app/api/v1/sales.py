from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
import libsql_client

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.sale import (
    SaleCreate,
    SaleCancelRequest,
    SaleResponse,
    SaleListResponse
)
from app.services import sale_service
from app.services.sales_export_service import build_sales_workbook
from app.services.sale_service import SaleError
from app.repositories import sale_repo

router = APIRouter(prefix="/sales", tags=["Ventas"])

@router.get("/export.xlsx")
async def export_sales_xlsx(
    month: int = Query(..., ge=1, le=12, description="Mes a exportar (1-12)"),
    year: int = Query(..., ge=2000, le=2100, description="Año a exportar"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    rows = await sale_repo.get_sales_export_rows(db, year=year, month=month)
    workbook_bytes = build_sales_workbook(rows, year=year, month=month)
    filename = f"ventas_{year:04d}_{month:02d}.xlsx"
    return Response(
        content=workbook_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("", response_model=SaleListResponse)
async def list_sales(
    month: Optional[int] = Query(None, ge=1, le=12, description="Mes a filtrar (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Año a filtrar (ej. 2026)"),
    status: Optional[str] = Query(None, description="Filtrar por estado ('COMPLETED' o 'CANCELLED')"),
    search: Optional[str] = Query(None, description="Buscar por número de venta o notas"),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(25, ge=1, le=100, description="Elementos por página"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Lista el historial de ventas paginado con filtros de mes, año, estado y búsqueda de texto.
    """
    offset = (page - 1) * page_size
    sales, total = await sale_repo.list_sales(
        client=db,
        month=month,
        year=year,
        status=status,
        search=search,
        limit=page_size,
        offset=offset
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return SaleListResponse(
        items=sales,  # type: ignore
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Registra una nueva venta con sus líneas de productos de forma atómica:
    - Valida stock suficiente.
    - Congela el costo unitario histórico.
    - Descuenta el inventario y genera movimientos SALE_EXIT.
    - Previene duplicaciones mediante idempotency_key.
    """
    try:
        sale = await sale_service.create_sale(
            client=db,
            data=payload,
            user_id=current_user["id"]
        )
        return sale
    except SaleError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Obtiene los detalles completos de una venta específica incluyendo el desglose de sus productos.
    """
    sale = await sale_repo.get_sale_by_id(db, sale_id)
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada.")

    items = await sale_repo.get_sale_items(db, sale_id)
    sale["items"] = items
    return sale

@router.post("/{sale_id}/cancel", response_model=SaleResponse)
async def cancel_sale(
    sale_id: str,
    payload: SaleCancelRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Anula una venta completada:
    - Marca el estado como CANCELLED con el motivo de auditoría.
    - Reintegra automáticamente el stock de los productos.
    - Registra movimientos de tipo SALE_REVERSION en el inventario.
    """
    try:
        sale = await sale_service.cancel_sale(
            client=db,
            sale_id=sale_id,
            reason=payload.cancellation_reason,
            user_id=current_user["id"]
        )
        return sale
    except SaleError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
