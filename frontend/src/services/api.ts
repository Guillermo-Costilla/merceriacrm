export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  const config: RequestInit = {
    ...options,
    credentials: 'include', // Enviar y recibir cookies HttpOnly automáticamente
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config)

  if (!response.ok) {
    let errorMessage = `Error del servidor (${response.status})`
    try {
      const data = await response.json()
      if (data && data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      } else if (data && data.message) {
        errorMessage = data.message
      }
    } catch {
      // Si la respuesta no es JSON, se conserva el mensaje genérico
    }
    throw new ApiError(errorMessage, response.status)
  }

  return response.json()
}

export async function apiFetchBlob(endpoint: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })

  if (!response.ok) {
    let errorMessage = `Error del servidor (${response.status})`
    try {
      const data = await response.json()
      if (data && data.detail) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)
      } else if (data && data.message) {
        errorMessage = data.message
      }
    } catch {
      // Keep the generic server error when the response is not JSON.
    }
    throw new ApiError(errorMessage, response.status)
  }

  return response.blob()
}
