import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { LoginForm } from '../auth/LoginForm'

export function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="session-loading">Checking session…</p>
  }
  // Covers both a successful login (login() sets `user`) and visiting /login while signed in.
  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="login-page">
      <h1>Ticket Management System</h1>
      <LoginForm />
    </main>
  )
}
