import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { api, errorMessage } from '@/lib/api'
import type { DashboardStats as DashboardStatsData } from '@/types/ticket'
import { formatDuration } from './formatDuration'

const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })

// One stat in the panel: the label, the number (the group's only <p>) and an optional hint.
// `ai` adds the sun dot that marks figures about the AI.
function Stat({ label, value, hint, ai }: { label: string; value: string; hint?: string; ai?: boolean }) {
  return (
    <div role="group" aria-label={label} className="px-5 py-4">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {ai && <span aria-hidden="true" className="size-2 rounded-full bg-sun" />}
        {label}
      </span>
      <p className="mt-1 font-heading text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

// One mint panel: the 1px gaps show the page background, so they read as dividers however the
// grid wraps. The last stat spans the row the two-column layout would leave half empty.
const statsPanel =
  'grid gap-px overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-5 [&>*]:bg-muted [&>*:last-child]:sm:col-span-2 [&>*:last-child]:lg:col-span-1'

function waitingSummary(open: number) {
  if (open === 0) return 'Nothing is waiting for a reply.'
  return open === 1 ? '1 ticket is waiting for a reply.' : `${open.toLocaleString()} tickets are waiting for a reply.`
}

// Headline ticket numbers. The ['tickets', 'stats'] key is refreshed by the ticket mutations,
// which invalidate every non-detail ticket query.
export function DashboardStats() {
  const stats = useQuery({
    queryKey: ['tickets', 'stats'],
    queryFn: () => api.get<DashboardStatsData>('/api/dashboard').then((r) => r.data),
  })

  if (stats.isPending) {
    return (
      <div aria-busy="true" aria-label="Loading statistics">
        <Skeleton className="mb-6 h-5 w-64" />
        <Skeleton className="h-32 rounded-2xl lg:h-28" />
      </div>
    )
  }

  if (stats.isError) {
    return (
      <div className="mt-6">
        <ErrorAlert>{errorMessage(stats.error, 'Could not load ticket statistics.')}</ErrorAlert>
      </div>
    )
  }

  const { totalTickets, openTickets, resolvedByAi, averageResolutionSeconds } = stats.data

  return (
    <>
      <span className="mb-6 block text-muted-foreground">{waitingSummary(openTickets)}</span>
      <div className={statsPanel}>
        <Stat label="Open tickets" value={openTickets.toLocaleString()} />
        <Stat label="Total tickets" value={totalTickets.toLocaleString()} />
        <Stat label="Resolved by AI" value={resolvedByAi.toLocaleString()} ai />
        <Stat
          label="Resolved by AI (%)"
          value={totalTickets === 0 ? '—' : percentFormat.format(resolvedByAi / totalTickets)}
          hint="Of all tickets"
          ai
        />
        <Stat
          label="Avg. resolution time"
          value={averageResolutionSeconds === null ? '—' : formatDuration(averageResolutionSeconds)}
          hint="Created to resolved or closed"
        />
      </div>
    </>
  )
}
