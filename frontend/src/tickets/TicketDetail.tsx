import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/ErrorAlert'
import { api, errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { TicketDetailHeading } from './TicketDetailHeading'
import { TicketDetailSkeleton } from './TicketDetailSkeleton'
import { TicketProperties } from './TicketProperties'
import { TicketReplyForm } from './TicketReplyForm'
import { TicketThread } from './TicketThread'
import { ticketDetailColumns } from './ticketDisplay'

// canAssign shows an assignee picker instead of plain text (admins only; the API enforces it too).
export function TicketDetail({ ticketId, canAssign }: { ticketId: number; canAssign: boolean }) {
  const ticket = useQuery({
    queryKey: ['tickets', 'detail', ticketId],
    queryFn: () => api.get<TicketDetailData>(`/api/tickets/${ticketId}`).then((r) => r.data),
  })

  if (ticket.isPending) {
    return <TicketDetailSkeleton />
  }

  if (ticket.isError) {
    return <ErrorAlert>{errorMessage(ticket.error, 'Could not load the ticket.')}</ErrorAlert>
  }

  const t = ticket.data
  return (
    <article aria-labelledby="ticket-subject" className={ticketDetailColumns}>
      <div className="min-w-0">
        <TicketDetailHeading ticket={t} />

        <TicketThread ticket={t} />

        <section aria-labelledby="ticket-reply" className="mt-8">
          <h2 id="ticket-reply" className="mb-3">
            Reply
          </h2>
          <TicketReplyForm ticket={t} />
        </section>
      </div>

      <TicketProperties ticket={t} canAssign={canAssign} />
    </article>
  )
}
