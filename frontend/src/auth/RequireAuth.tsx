import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './authContext'

// Layout route guarding everything nested under it. Signing out (or a 401
// from apiFetch) clears `user`, so this redirects to /login on its own.
export function RequireAuth() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="session-loading">Checking session…</p>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
