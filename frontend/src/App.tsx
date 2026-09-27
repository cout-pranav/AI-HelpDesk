import { useEffect, useState } from 'react'
import './App.css'
import { useAuth } from './auth/authContext'
import { LoginForm } from './auth/LoginForm'

type HealthStatus = 'checking' | 'ok' | 'error'

function App() {
  const [status, setStatus] = useState<HealthStatus>('checking')
  const { user, isLoading, logout } = useAuth()

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/health`)
      .then((res) => (res.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <main>
      <h1>Ticket Management System</h1>
      <p>
        Backend status: <strong className={`status status-${status}`}>{status}</strong>
      </p>
      {isLoading ? (
        <p>Checking session…</p>
      ) : user ? (
        <p>
          Signed in as <strong>{user.displayName}</strong> ({user.role}){' '}
          <button type="button" onClick={logout}>
            Log out
          </button>
        </p>
      ) : (
        <LoginForm />
      )}
    </main>
  )
}

export default App
