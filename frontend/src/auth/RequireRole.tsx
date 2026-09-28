import { Navigate, Outlet } from 'react-router-dom'
import { useAuth, type Role } from './authContext'

// Layout route for role-gated pages. Nest it under <RequireAuth /> so `user`
// is already loaded; users without the role are sent back to the home page.
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()

  if (user?.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
