import { useEffect, useState } from 'react'
import './App.css'

type HealthStatus = 'checking' | 'ok' | 'error'

function App() {
  const [status, setStatus] = useState<HealthStatus>('checking')

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
    </main>
  )
}

export default App
