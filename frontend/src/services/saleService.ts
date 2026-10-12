import { apiFetch } from './api'
import type { 
  Sale, 
  SaleListResponse, 
  SaleCreateData, 
  SaleCancelData,
  SaleFilterParams 
} from '../types/sale'

export const saleService = {
  async getSales(params: SaleFilterParams = {}): Promise<SaleListResponse> {
    const query = new URLSearchParams()
    if (params.month) query.set('month', String(params.month))
    if (params.year) query.set('year', String(params.year))
    if (params.status && params.status !== 'all') query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', String(params.page))
    if (params.page_size) query.set('page_size', String(params.page_size))

    const qs = query.toString()
    return apiFetch<SaleListResponse>(`/api/sales${qs ? `?${qs}` : ''}`)
  },

  async getSale(id: string): Promise<Sale> {
    return apiFetch<Sale>(`/api/sales/${id}`)
  },

  async createSale(data: SaleCreateData): Promise<Sale> {
    return apiFetch<Sale>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async cancelSale(id: string, data: SaleCancelData): Promise<Sale> {
    return apiFetch<Sale>(`/api/sales/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
