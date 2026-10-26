import { createContext, useContext } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { AuthUser, LoginCredentials, LoginResponse } from '@/types/auth'

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
