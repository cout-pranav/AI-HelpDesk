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
  const statusColor = {
    checking: 'text-yellow-600',
    error: 'text-red-600',
    ok: 'text-green-700 dark:text-green-500',
  }[status]

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Welcome, {user?.displayName}</h1>
      <p>
        Backend status: <strong className={`capitalize ${statusColor}`}>{status}</strong>
      </p>
    </>
  )
}
