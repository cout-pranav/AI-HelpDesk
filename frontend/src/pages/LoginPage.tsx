import { Ticket } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { LoginForm } from '../auth/LoginForm'

export function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-center text-muted-foreground">Checking session…</p>
  }
  // Covers both a successful login (login() sets `user`) and visiting /login while signed in.
  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ticket className="size-4" />
          </div>
          Ticket Management System
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
