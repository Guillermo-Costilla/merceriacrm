import { apiFetch } from './api'
import type { 
  InventoryMovement, 
  InventoryMovementCreateData, 
  InventoryMovementListResponse, 
  InventoryReconciliationReport 
} from '../types/inventory'

export interface InventoryQueryParams {
  product_id?: string
  movement_type?: string
  search?: string
  page?: number
  page_size?: number
}

export const inventoryService = {
  async getMovements(params: InventoryQueryParams = {}): Promise<InventoryMovementListResponse> {
    const query = new URLSearchParams()
    if (params.product_id) query.set('product_id', params.product_id)
    if (params.movement_type && params.movement_type !== 'all') query.set('movement_type', params.movement_type)
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', String(params.page))
    if (params.page_size) query.set('page_size', String(params.page_size))

    const qs = query.toString()
    return apiFetch<InventoryMovementListResponse>(`/api/inventory/movements${qs ? `?${qs}` : ''}`)
  },

  async createMovement(data: InventoryMovementCreateData): Promise<InventoryMovement> {
    return apiFetch<InventoryMovement>('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getReconciliation(): Promise<InventoryReconciliationReport> {
    return apiFetch<InventoryReconciliationReport>('/api/inventory/reconciliation')
  },
}
