import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './authContext'

// Layout route guarding everything nested under it. Signing out (or a 401
// from the api client) clears `user`, so this redirects to /login on its own.
export function RequireAuth() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="session-loading">Checking session…</p>
  }
  //User ne back button press kela tar login page var redirect honar.
  if (!user) {
    return <Navigate to="/login" replace />
  }
  //child routes render hota. Outlet is used to render the child routes of the current route.
  return <Outlet />
}
