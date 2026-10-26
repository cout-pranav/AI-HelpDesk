import { Skeleton } from '@/components/ui/skeleton'
import { ticketDetailColumns } from './ticketDisplay'

// Placeholder for the ticket detail page while it loads: the heading, the thread and the
// properties sidebar, in the same two-column layout as TicketDetail.
export function TicketDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading ticket" className={ticketDetailColumns}>
      <div>
        <Skeleton className="mb-2 h-4 w-12" />
        <Skeleton className="mb-4 h-8 w-96 max-w-full" />
        <div className="mb-6 grid gap-2">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  )
}
