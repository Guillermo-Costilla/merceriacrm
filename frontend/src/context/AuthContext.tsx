import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '../types/auth'
import { authService } from '../services/authService'
import { ApiError } from '../services/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (businessName: string, fullName: string, email: string, password: string, businessLogo: string | null) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  const refreshUser = async () => {
    try {
      const currentUser = await authService.getMe()
      setUser(currentUser)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUser()
  }, [])

  const login = async (email: string, password: string) => {
    const loggedUser = await authService.login(email, password)
    setUser(loggedUser)
  }

  const register = async (businessName: string, fullName: string, email: string, password: string, businessLogo: string | null) => {
    const registeredUser = await authService.register(businessName, fullName, email, password, businessLogo)
    setUser(registeredUser)
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
  }
  return context
}
