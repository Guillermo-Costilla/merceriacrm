export interface User {
  id: string
  business_id: string
  business_name: string
  business_logo_data_url: string | null
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface AuthMessageResponse {
  message: string
  success: boolean
}
