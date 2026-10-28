import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, errorMessage } from '@/lib/api'
import type { DashboardStats as DashboardStatsData } from '@/types/ticket'
import { formatDuration } from './formatDuration'

const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

const statLabels = [
  'Total tickets',
  'Open tickets',
  'Resolved by AI',
  'Resolved by AI (%)',
  'Avg. resolution time',
]

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card role="group" aria-label={label}>
      <CardHeader>
        <CardTitle className="text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

const statsGrid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-5'

// Headline ticket numbers. The ['tickets', 'stats'] key is refreshed by the ticket mutations,
// which invalidate every non-detail ticket query.
export function DashboardStats() {
  const stats = useQuery({
    queryKey: ['tickets', 'stats'],
    queryFn: () => api.get<DashboardStatsData>('/api/dashboard').then((r) => r.data),
  })

  if (stats.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading statistics" className={statsGrid}>
        {statLabels.map((label) => (
          <Skeleton key={label} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  if (stats.isError) {
    return <ErrorAlert>{errorMessage(stats.error, 'Could not load ticket statistics.')}</ErrorAlert>
  }

  const { totalTickets, openTickets, resolvedByAi, averageResolutionSeconds } = stats.data

  return (
    <div className={statsGrid}>
      <StatCard label="Total tickets" value={totalTickets.toLocaleString()} />
      <StatCard label="Open tickets" value={openTickets.toLocaleString()} />
      <StatCard label="Resolved by AI" value={resolvedByAi.toLocaleString()} />
      <StatCard
        label="Resolved by AI (%)"
        value={totalTickets === 0 ? '—' : percentFormat.format(resolvedByAi / totalTickets)}
        hint="Of all tickets"
      />
      <StatCard
        label="Avg. resolution time"
        value={averageResolutionSeconds === null ? '—' : formatDuration(averageResolutionSeconds)}
        hint="Created to resolved or closed"
      />
    </div>
  )
}
