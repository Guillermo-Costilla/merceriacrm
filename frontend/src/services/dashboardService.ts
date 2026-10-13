import { apiFetch } from './api'
import type { DashboardSummary } from '../types/dashboard'

export const dashboardService = {
  async getDashboard(year?: number, month?: number): Promise<DashboardSummary> {
    const query = new URLSearchParams()
    if (year) query.set('year', String(year))
    if (month) query.set('month', String(month))

    const qs = query.toString()
    return apiFetch<DashboardSummary>(`/api/dashboard${qs ? `?${qs}` : ''}`)
  },
}
