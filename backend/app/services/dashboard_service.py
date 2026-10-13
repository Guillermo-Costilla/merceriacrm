import calendar
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
import libsql_client

from app.core.config import settings
from app.schemas.dashboard import (
    DashboardKpis,
    DailySalesPoint,
    TopProductItem,
    DashboardSummaryResponse
)
from app.repositories import dashboard_repo

MONTH_NAMES_ES = [
    "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

def get_argentina_now() -> datetime:
    try:
        return datetime.now(ZoneInfo(settings.BUSINESS_TIMEZONE))
    except Exception:
        return datetime.now().astimezone()

def get_business_day_utc_range(now: datetime) -> tuple[str, str]:
    """Return UTC timestamp bounds for the current business-local calendar day."""
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    next_day_start = day_start + timedelta(days=1)
    return (
        day_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        next_day_start.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    )

async def get_dashboard_summary(
    client: libsql_client.Client,
    business_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None
) -> DashboardSummaryResponse:
    now_ar = get_argentina_now()
    sel_year = year if year else now_ar.year
    sel_month = month if month else now_ar.month

    period_str = f"{sel_year:04d}-{sel_month:02d}"
    day_start_utc, next_day_start_utc = get_business_day_utc_range(now_ar)

    # 1. Ventas de Hoy
    today_sales_data = await dashboard_repo.get_today_sales(
        client,
        business_id,
        day_start_utc,
        next_day_start_utc
    )

    # 2. Resumen del mes seleccionado
    curr_summary = await dashboard_repo.get_sales_period_summary(client, business_id, period_str)
    curr_units_sold = await dashboard_repo.get_period_units_sold(client, business_id, period_str)

    # 3. Resumen del mes anterior (mes calendario completo y MTD)
    if sel_month == 1:
        prev_year = sel_year - 1
        prev_month = 12
    else:
        prev_year = sel_year
        prev_month = sel_month - 1
    prev_period_str = f"{prev_year:04d}-{prev_month:02d}"

    # Si estamos consultando el mes actual en curso, calculamos MTD con el día de hoy
    is_current_month = (sel_year == now_ar.year and sel_month == now_ar.month)
    mtd_day = now_ar.day if is_current_month else None

    prev_full_summary = await dashboard_repo.get_sales_period_summary(client, business_id, prev_period_str)
    prev_mtd_summary = await dashboard_repo.get_sales_period_summary(
        client, business_id, prev_period_str, max_day=mtd_day
    )

    # 4. Cálculo de variaciones porcentuales (evitando división por cero)
    curr_sales = curr_summary["total_sales_cents"]
    prev_full_sales = prev_full_summary["total_sales_cents"]
    prev_mtd_sales = prev_mtd_summary["total_sales_cents"]

    monthly_variation_pct = None
    if prev_full_sales > 0:
        monthly_variation_pct = round(((curr_sales - prev_full_sales) / prev_full_sales) * 100, 1)

    mtd_variation_pct = None
    if is_current_month and prev_mtd_sales > 0:
        mtd_variation_pct = round(((curr_sales - prev_mtd_sales) / prev_mtd_sales) * 100, 1)

    # 5. Indicadores de inventario
    inventory_kpis = await dashboard_repo.get_inventory_kpis(client, business_id)

    # 6. Serie diaria para el gráfico (completando los días del mes para visualización continua)
    days_in_month = calendar.monthrange(sel_year, sel_month)[1]
    raw_series = await dashboard_repo.get_daily_sales_series(client, business_id, period_str)
    series_map = {row["day"]: row for row in raw_series}

    daily_points: List[DailySalesPoint] = []
    # Si es el mes en curso, podemos mostrar hasta el último día o hasta hoy
    for d in range(1, days_in_month + 1):
        d_str = f"{sel_year:04d}-{sel_month:02d}-{d:02d}"
        if d in series_map:
            p = series_map[d]
            daily_points.append(
                DailySalesPoint(
                    day=d,
                    date=d_str,
                    sales_cents=int(p["sales_cents"]),
                    profit_cents=int(p["profit_cents"]),
                    operations_count=int(p["operations_count"])
                )
            )
        else:
            daily_points.append(
                DailySalesPoint(
                    day=d,
                    date=d_str,
                    sales_cents=0,
                    profit_cents=0,
                    operations_count=0
                )
            )

    # 7. Top 3 productos del período
    top_prods_raw = await dashboard_repo.get_top_products_period(client, business_id, period_str, limit=3)
    top_products = [
        TopProductItem(
            product_id=p["product_id"],
            sku=p["sku"],
            name=p["name"],
            unit_of_measure=p["unit_of_measure"],
            units_sold=float(p["units_sold"]),
            revenue_cents=int(p["revenue_cents"]),
            profit_cents=int(p["profit_cents"])
        )
        for p in top_prods_raw
    ]

    kpis = DashboardKpis(
        today_sales_cents=today_sales_data["total_cents"],
        today_sales_count=today_sales_data["operations_count"],
        current_month_sales_cents=curr_sales,
        current_month_sales_count=curr_summary["operations_count"],
        current_month_units_sold=curr_units_sold,
        current_month_gross_profit_cents=curr_summary["total_profit_cents"],
        previous_month_total_sales_cents=prev_full_sales,
        previous_month_mtd_sales_cents=prev_mtd_sales,
        monthly_variation_pct=monthly_variation_pct,
        mtd_variation_pct=mtd_variation_pct,
        low_stock_products_count=inventory_kpis["low_stock"],
        out_of_stock_products_count=inventory_kpis["out_of_stock"],
        total_active_products=inventory_kpis["total_active"]
    )

    period_label = f"{MONTH_NAMES_ES[sel_month]} {sel_year}"

    return DashboardSummaryResponse(
        kpis=kpis,
        daily_sales=daily_points,
        top_products=top_products,
        selected_year=sel_year,
        selected_month=sel_month,
        period_label=period_label
    )
