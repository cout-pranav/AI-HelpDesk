import { createContext, useContext } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'

export type Role = 'Admin' | 'Agent'

export type AuthUser = {
  id: number
  email: string
  displayName: string
  role: Role
}

export type LoginResponse = {
  token: string
  expiresAt: string
  user: AuthUser
}

export type LoginCredentials = {
  email: string
  password: string
}

export type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: UseMutationResult<LoginResponse, Error, LoginCredentials>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
