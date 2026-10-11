export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface AuthMessageResponse {
  message: string
  success: boolean
}
