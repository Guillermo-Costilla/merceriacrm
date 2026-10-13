export interface DashboardKpis {
  today_sales_cents: number
  today_sales_count: number
  current_month_sales_cents: number
  current_month_sales_count: number
  current_month_units_sold: number
  current_month_gross_profit_cents: number
  previous_month_total_sales_cents: number
  previous_month_mtd_sales_cents: number
  monthly_variation_pct?: number | null
  mtd_variation_pct?: number | null
  low_stock_products_count: number
  out_of_stock_products_count: number
  total_active_products: number
}

export interface DailySalesPoint {
  day: number
  date: string
  sales_cents: number
  profit_cents: number
  operations_count: number
}

export interface TopProductItem {
  product_id: string
  sku: string
  name: string
  unit_of_measure: string
  units_sold: number
  revenue_cents: number
  profit_cents: number
}

export interface DashboardSummary {
  kpis: DashboardKpis
  daily_sales: DailySalesPoint[]
  top_products: TopProductItem[]
  selected_year: number
  selected_month: number
  period_label: string
}
