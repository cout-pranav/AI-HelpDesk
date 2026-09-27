import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="navbar">
        <Link to="/" className="navbar-title">
          Ticket Management
        </Link>
        {user && (
          <div className="navbar-user">
            <span>
              {user.displayName} ({user.role})
            </span>
            <button type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
