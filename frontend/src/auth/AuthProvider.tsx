import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiFetch, configureApiAuth } from '../lib/api'
import { AuthContext, type AuthContextValue, type AuthUser, type LoginResponse } from './authContext'

const TOKEN_STORAGE_KEY = 'auth.token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(token !== null)

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    configureApiAuth({ getToken: () => token, onUnauthorized: logout })
  }, [token, logout])

  // Validate a token restored from localStorage.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!stored) return

    let cancelled = false
    apiFetch<AuthUser>('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
      .then((me) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) logout()
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
    setToken(res.token)
    setUser(res.user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
