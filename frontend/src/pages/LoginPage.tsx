import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { LoginForm } from '../auth/LoginForm'

export function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-center text-gray-500">Checking session…</p>
  }
  // Covers both a successful login (login() sets `user`) and visiting /login while signed in.
  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold">Ticket Management System</h1>
      <LoginForm />
    </main>
  )
}
