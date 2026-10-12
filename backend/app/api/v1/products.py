from typing import Optional, Dict, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
import libsql_client

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    ProductStatusUpdate
)
from app.services import product_service
from app.services.product_service import ProductError
from app.repositories import product_repo

router = APIRouter(prefix="/products", tags=["Productos"])

@router.get("", response_model=ProductListResponse)
async def list_products(
    search: Optional[str] = Query(None, description="Búsqueda por nombre o SKU"),
    category_id: Optional[str] = Query(None, description="Filtrar por ID de categoría"),
    stock_status: Optional[str] = Query(None, description="Filtrar por estado de stock: 'in_stock', 'low', 'out'"),
    is_active: Optional[bool] = Query(None, description="Filtrar por estado activo/inactivo"),
    order_by: str = Query("name", description="Campo de ordenación: name, sku, current_stock, price_cents, created_at"),
    order_dir: str = Query("asc", description="Dirección: asc o desc"),
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Elementos por página"),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Lista productos con filtros avanzados por texto, categoría, stock bajo, agotados y ordenación.
    """
    offset = (page - 1) * page_size
    items, total = await product_repo.list_products(
        client=db,
        search=search,
        category_id=category_id,
        stock_status=stock_status,
        is_active=is_active,
        order_by=order_by,
        order_dir=order_dir,
        limit=page_size,
        offset=offset
    )

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ProductListResponse(
        items=items, # type: ignore
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )

@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: libsql_client.Client = Depends(get_db)
):
    """
    Obtiene los detalles completos de un producto específico.
    """
    product = await product_repo.get_product_by_id(db, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return product

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Registra un nuevo producto con validación de SKU único e inicialización de stock.
    """
    try:
        created = await product_service.create_product(
            client=db,
            data=payload,
            user_id=current_user["id"]
        )
        return created
    except ProductError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Actualiza la información de un producto existente.
    """
    try:
        updated = await product_service.update_product(
            client=db,
            product_id=product_id,
            data=payload
        )
        return updated
    except ProductError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.patch("/{product_id}/status", response_model=ProductResponse)
async def toggle_product_status(
    product_id: str,
    payload: ProductStatusUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Activa o desactiva lógicamente un producto.
    """
    try:
        updated = await product_service.set_product_status(
            client=db,
            product_id=product_id,
            is_active=payload.is_active
        )
        return updated
    except ProductError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

@router.delete("/{product_id}")
async def delete_product(
    product_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Desactiva lógicamente el producto para preservar el historial si tiene movimientos o ventas asociadas.
    """
    try:
        result = await product_service.delete_or_deactivate_product(
            client=db,
            product_id=product_id
        )
        return result
    except ProductError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
