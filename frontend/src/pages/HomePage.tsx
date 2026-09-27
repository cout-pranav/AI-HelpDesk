import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { api } from '../lib/api'

export function HomePage() {
  const { user } = useAuth()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get<{ status: string }>('/api/health').then((r) => r.data),
  })

  const status = health.isPending ? 'checking' : health.isError ? 'error' : 'ok'

  return (
    <>
      <h1>Welcome, {user?.displayName}</h1>
      <p>
        Backend status: <strong className={`status status-${status}`}>{status}</strong>
      </p>
    </>
  )
}
