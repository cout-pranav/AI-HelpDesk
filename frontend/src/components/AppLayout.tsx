import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-semibold">
            Ticket Management
          </Link>
          
          <nav className="flex items-center gap-4 text-sm">
            <NavLink to="/tickets">Tickets</NavLink>
            {user?.role === 'Admin' && <NavLink to="/users">Users</NavLink>}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span>
              {user.displayName} ({user.role})
            </span>
            <button
              type="button"
              onClick={logout}
              className="cursor-pointer rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <main className="px-6 py-4">
        <Outlet />
      </main>
    </>
  )
}
