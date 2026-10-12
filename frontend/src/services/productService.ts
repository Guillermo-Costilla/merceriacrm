import { apiFetch } from './api'
import type { 
  Product, 
  ProductListResponse, 
  ProductCreateData, 
  ProductUpdateData, 
  Category 
} from '../types/product'

export interface ProductQueryParams {
  search?: string
  category_id?: string
  stock_status?: string
  is_active?: boolean
  order_by?: string
  order_dir?: string
  page?: number
  page_size?: number
}

export const productService = {
  async getProducts(params: ProductQueryParams = {}): Promise<ProductListResponse> {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.category_id) query.set('category_id', params.category_id)
    if (params.stock_status && params.stock_status !== 'all') query.set('stock_status', params.stock_status)
    if (params.is_active !== undefined) query.set('is_active', String(params.is_active))
    if (params.order_by) query.set('order_by', params.order_by)
    if (params.order_dir) query.set('order_dir', params.order_dir)
    if (params.page) query.set('page', String(params.page))
    if (params.page_size) query.set('page_size', String(params.page_size))

    const qs = query.toString()
    return apiFetch<ProductListResponse>(`/api/products${qs ? `?${qs}` : ''}`)
  },

  async getProduct(id: string): Promise<Product> {
    return apiFetch<Product>(`/api/products/${id}`)
  },

  async createProduct(data: ProductCreateData): Promise<Product> {
    return apiFetch<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateProduct(id: string, data: ProductUpdateData): Promise<Product> {
    return apiFetch<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  async toggleProductStatus(id: string, isActive: boolean): Promise<Product> {
    return apiFetch<Product>(`/api/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    })
  },

  async deleteProduct(id: string): Promise<{ action: string; message: string }> {
    return apiFetch<{ action: string; message: string }>(`/api/products/${id}`, {
      method: 'DELETE',
    })
  },
}

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    return apiFetch<Category[]>('/api/categories')
  },

  async createCategory(name: string, description?: string): Promise<Category> {
    return apiFetch<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  },
}
