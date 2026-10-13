from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
import libsql_client

from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("", response_model=DashboardSummaryResponse)
async def get_dashboard(
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Año a consultar"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Mes a consultar"),
    current_user: Dict[str, Any] = Depends(get_current_user),
    db: libsql_client.Client = Depends(get_db)
):
    """
    Retorna métricas clave consolidadas del negocio:
    - Ventas del día, del mes en curso y del mes anterior.
    - Variación porcentual y Month-To-Date (MTD).
    - Unidades vendidas y ganancia bruta estimada congelada.
    - Indicadores de stock bajo y agotado.
    - Evolución diaria de ventas para gráficos.
    - Top 3 productos más vendidos.
    """
    return await dashboard_service.get_dashboard_summary(
        client=db,
        business_id=current_user["business_id"],
        year=year,
        month=month
    )
