import { apiFetch } from './api'
import type { User, AuthMessageResponse } from '../types/auth'

export const authService = {
  async login(email: string, password: string): Promise<User> {
    return apiFetch<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  async logout(): Promise<AuthMessageResponse> {
    return apiFetch<AuthMessageResponse>('/api/auth/logout', {
      method: 'POST',
    })
  },

  async getMe(): Promise<User> {
    return apiFetch<User>('/api/auth/me', {
      method: 'GET',
    })
  },

  async forgotPassword(email: string): Promise<AuthMessageResponse> {
    return apiFetch<AuthMessageResponse>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  },

  async resetPassword(token: string, newPassword: string): Promise<AuthMessageResponse> {
    return apiFetch<AuthMessageResponse>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    })
  },
}
