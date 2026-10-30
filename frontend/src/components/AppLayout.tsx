import { LogOut, MessagesSquare } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/UserAvatar'
import { cn } from '@/lib/utils'
import { useAuth } from '../auth/authContext'

// Pill-shaped nav links; the current page gets the mint fill.
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
    isActive ? 'bg-muted text-primary' : 'text-muted-foreground hover:text-foreground',
  )

export function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <>
      {/* Sticky only from sm up: on phones the header wraps and would take too much of the screen. */}
      <header className="top-0 z-10 sm:sticky bg-background/90 shadow-[0_1px_0_var(--color-muted)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link to="/" className="flex items-center gap-2 font-heading text-lg font-semibold tracking-tight">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessagesSquare className="size-4" />
              </span>
              Support desk
            </Link>
            <nav className="flex items-center gap-1">
              {/* `end`, or "/" would count as active on every page. */}
              <NavLink to="/" end className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/tickets" className={navLinkClass}>
                Tickets
              </NavLink>
              {user?.role === 'Admin' && (
                <NavLink to="/users" className={navLinkClass}>
                  Users
                </NavLink>
              )}
            </nav>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <UserAvatar name={user.displayName} />
              <span className="text-sm leading-tight">
                <span className="block font-medium">{user.displayName}</span>
                <span className="block text-xs text-muted-foreground">{user.role}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut />
                Sign out
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </>
  )
}
