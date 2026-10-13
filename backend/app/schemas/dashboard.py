from pydantic import BaseModel
from typing import Optional, List

class DashboardKpis(BaseModel):
    # Hoy
    today_sales_cents: int
    today_sales_count: int

    # Mes actual
    current_month_sales_cents: int
    current_month_sales_count: int
    current_month_units_sold: float
    current_month_gross_profit_cents: int

    # Comparativas mes anterior
    previous_month_total_sales_cents: int
    previous_month_mtd_sales_cents: int
    monthly_variation_pct: Optional[float] = None
    mtd_variation_pct: Optional[float] = None

    # Alertas de catálogo
    low_stock_products_count: int
    out_of_stock_products_count: int
    total_active_products: int

class DailySalesPoint(BaseModel):
    day: int
    date: str
    sales_cents: int
    profit_cents: int
    operations_count: int

class TopProductItem(BaseModel):
    product_id: str
    sku: str
    name: str
    unit_of_measure: str
    units_sold: float
    revenue_cents: int
    profit_cents: int

class DashboardSummaryResponse(BaseModel):
    kpis: DashboardKpis
    daily_sales: List[DailySalesPoint]
    top_products: List[TopProductItem]
    selected_year: int
    selected_month: int
    period_label: str
