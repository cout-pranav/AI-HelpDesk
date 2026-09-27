import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, configureApiAuth } from '../lib/api'
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
  type LoginCredentials,
  type LoginResponse,
} from './authContext'

const TOKEN_STORAGE_KEY = 'auth.token'
const ME_QUERY_KEY = ['auth', 'me'] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    // Drop every cached response so nothing from this session leaks into the next.
    queryClient.clear()
  }, [queryClient])

  useEffect(() => {
    configureApiAuth({ getToken: () => token, onUnauthorized: logout })
  }, [token, logout])

  // Pass the header explicitly so the first request doesn't depend on the
  // configureApiAuth effect above having run yet.
  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () =>
      api
        .get<AuthUser>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.data),
    enabled: token !== null,
  })

  const login = useMutation({
    mutationFn: ({ email, password }: LoginCredentials) =>
      api.post<LoginResponse>('/api/auth/login', { email, password }).then((r) => r.data),
    onSuccess: (res) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, res.token)
      // Seed the cache so enabling the `me` query doesn't trigger a redundant fetch.
      queryClient.setQueryData(ME_QUERY_KEY, res.user)
      setToken(res.token)
    },
  })

  // A 401 on `me` signs out via the api client's onUnauthorized. Any other failure (e.g.
  // API unreachable) leaves `user` null, so RequireAuth sends the user to /login.
  const user = token ? (meQuery.data ?? null) : null
  const isLoading = token !== null && meQuery.isPending

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
