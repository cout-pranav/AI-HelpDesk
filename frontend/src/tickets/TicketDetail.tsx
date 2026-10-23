import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, errorMessage } from '@/lib/api'
import { TicketAssignee } from './TicketAssignee'
import { TicketCategorySelect } from './TicketCategorySelect'
import { TicketReplyForm } from './TicketReplyForm'
import { TicketStatusSelect } from './TicketStatusSelect'
import { TicketThread } from './TicketThread'
import {
  formatDate,
  type TicketAssigneeData,
  type TicketCategory,
  type TicketStatus,
} from './ticketDisplay'

export type TicketMessage = {
  id: number
  // inbound: from the customer; outbound: an agent's reply.
  direction: 'inbound' | 'outbound'
  senderEmail: string
  senderName: string | null
  body: string
  attachmentNames: string[]
  createdAt: string
}

export type TicketDetailData = {
  id: number
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  source: string
  submitterEmail: string
  submitterName: string | null
  createdAt: string
  updatedAt: string
  assignee: TicketAssigneeData | null
  messages: TicketMessage[]
}

// Wide main column for the ticket and its thread; a fixed-width sidebar for the editable fields,
// so every dropdown gets the same width. The columns stack on small screens.
const columnsClass = 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]'

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
    <article aria-labelledby="ticket-subject" className={columnsClass}>
      <div className="min-w-0">
        <header className="mb-6">
          <p className="text-sm text-muted-foreground">#{t.id}</p>
          <h1 id="ticket-subject" className="mb-3 break-words">
            {t.subject}
          </h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt>Submitter</dt>
            <dd className="min-w-0 break-words">
              {t.submitterName ? `${t.submitterName} <${t.submitterEmail}>` : t.submitterEmail}
            </dd>
            <dt>Source</dt>
            <dd className="capitalize">{t.source}</dd>
            <dt>Received</dt>
            <dd>
              <time dateTime={t.createdAt}>{formatDate(t.createdAt)}</time>
            </dd>
            <dt>Updated</dt>
            <dd>
              <time dateTime={t.updatedAt}>{formatDate(t.updatedAt)}</time>
            </dd>
          </dl>
        </header>

        <TicketThread messages={t.messages} />

        <section aria-labelledby="ticket-reply" className="mt-8">
          <h2 id="ticket-reply" className="mb-3">
            Reply
          </h2>
          <TicketReplyForm ticket={t} />
        </section>
      </div>

      {/* Stays in view while scrolling a long thread. */}
      <aside aria-label="Ticket properties" className="lg:sticky lg:top-6 lg:self-start">
        <Card size="sm">
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div className="grid gap-1.5">
                <dt>Status</dt>
                <dd>
                  <TicketStatusSelect ticket={t} />
                </dd>
              </div>
              <div className="grid gap-1.5">
                <dt>Category</dt>
                <dd>
                  <TicketCategorySelect ticket={t} />
                </dd>
              </div>
              <div className="grid gap-1.5">
                <dt>Assignee</dt>
                <dd>
                  <TicketAssignee ticket={t} canAssign={canAssign} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </aside>
    </article>
  )
}

function TicketDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading ticket" className={columnsClass}>
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
