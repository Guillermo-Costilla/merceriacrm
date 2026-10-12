export type MovementType = 
  | 'PURCHASE_ENTRY' 
  | 'SALE_EXIT' 
  | 'SALE_REVERSION' 
  | 'ADJUSTMENT_POSITIVE' 
  | 'ADJUSTMENT_NEGATIVE'

export interface InventoryMovement {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  unit_of_measure: string
  movement_type: MovementType
  quantity: number
  previous_stock: number
  resulting_stock: number
  reason: string
  reference_sale_id?: string | null
  created_by_user_id?: string | null
  created_by_user_name?: string | null
  created_at: string
}

export interface InventoryMovementCreateData {
  product_id: string
  movement_type: 'PURCHASE_ENTRY' | 'ADJUSTMENT_POSITIVE' | 'ADJUSTMENT_NEGATIVE'
  quantity: number
  reason: string
}

export interface InventoryMovementListResponse {
  items: InventoryMovement[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface InventoryReconciliationItem {
  product_id: string
  product_name: string
  sku: string
  unit_of_measure: string
  current_stock: number
  calculated_stock: number
  is_consistent: boolean
  difference: number
}

export interface InventoryReconciliationReport {
  total_products_checked: number
  consistent_count: number
  discrepancy_count: number
  is_fully_consistent: boolean
  items: InventoryReconciliationItem[]
}
