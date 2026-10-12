import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
import libsql_client

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.category import CategoryCreate, CategoryResponse
from app.repositories import category_repo

router = APIRouter(prefix="/categories", tags=["Categorías"])

@router.get("", response_model=List[CategoryResponse])
async def list_categories(
    db: libsql_client.Client = Depends(get_db)
):
    """
    Retorna todas las categorías activas ordenadas alfabéticamente.
    """
    return await category_repo.get_all_categories(db)

@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CategoryCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Crea una nueva categoría de productos.
    """
    existing = await category_repo.get_category_by_name(db, payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe una categoría con el nombre '{payload.name}'."
        )

    category_id = str(uuid.uuid4())
    cat = await category_repo.create_category(
        client=db,
        category_id=category_id,
        name=payload.name,
        description=payload.description
    )
    return cat
