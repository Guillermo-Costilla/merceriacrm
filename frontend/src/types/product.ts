export type UnitOfMeasure = 'unidad' | 'metro' | 'paquete' | 'rollo' | 'centimetro' | 'gramo'

export interface Category {
  id: string
  name: string
  description?: string | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category_id?: string | null
  category_name?: string | null
  description?: string | null
  cost_cents: number
  price_cents: number
  current_stock: number
  min_stock: number
  unit_of_measure: UnitOfMeasure
  is_fractional: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ProductCreateData {
  sku: string
  name: string
  category_id?: string | null
  description?: string | null
  cost_cents: number
  price_cents: number
  current_stock: number
  min_stock: number
  unit_of_measure: UnitOfMeasure
  is_fractional?: boolean
}

export interface ProductUpdateData {
  sku?: string
  name?: string
  category_id?: string | null
  description?: string | null
  cost_cents?: number
  price_cents?: number
  current_stock?: number
  min_stock?: number
  unit_of_measure?: UnitOfMeasure
  is_fractional?: boolean
}
