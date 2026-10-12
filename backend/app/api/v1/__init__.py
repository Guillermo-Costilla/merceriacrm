from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.categories import router as categories_router
from app.api.v1.products import router as products_router
from app.api.v1.inventory import router as inventory_router

api_v1_router = APIRouter(prefix="/api")
api_v1_router.include_router(auth_router)
api_v1_router.include_router(categories_router)
api_v1_router.include_router(products_router)
api_v1_router.include_router(inventory_router)
