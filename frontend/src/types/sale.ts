export interface SaleItemCreate {
  product_id: string
  quantity: number
  unit_price_cents?: number
}

export interface SaleCreateData {
  items: SaleItemCreate[]
  notes?: string
  idempotency_key?: string
}

export interface SaleCancelData {
  cancellation_reason: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  product_sku: string
  unit_of_measure: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents: number
  subtotal_cents: number
  estimated_gross_profit_cents: number
}

export interface Sale {
  id: string
  sale_number: number
  sale_date: string
  total_cents: number
  total_cost_cents: number
  estimated_gross_profit_cents: number
  status: 'COMPLETED' | 'CANCELLED'
  cancellation_reason?: string | null
  cancelled_at?: string | null
  notes?: string | null
  idempotency_key?: string | null
  created_by_user_id?: string | null
  created_by_user_name?: string | null
  created_at: string
  items: SaleItem[]
}

export interface SaleListResponse {
  items: Sale[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface SaleFilterParams {
  month?: number
  year?: number
  status?: string
  search?: string
  page?: number
  page_size?: number
}
