import { useEffect, useState } from 'react'
import { useAuth } from '../auth/authContext'

type HealthStatus = 'checking' | 'ok' | 'error'

export function HomePage() {
  const { user } = useAuth()
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_BASE_URL}/api/health`)
      .then((res) => (res.ok ? setStatus('ok') : setStatus('error')))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <>
      <h1>Welcome, {user?.displayName}</h1>
      <p>
        Backend status: <strong className={`status status-${status}`}>{status}</strong>
      </p>
    </>
  )
}
