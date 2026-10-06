import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Paperclip } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, ApiError } from '@/lib/api'
import { TicketAssignee } from './TicketAssignee'
import { TicketCategorySelect } from './TicketCategorySelect'
import { TicketStatusSelect } from './TicketStatusSelect'
import type { TicketAssigneeData, TicketCategory, TicketStatus } from './ticketDisplay'

export type TicketMessage = {
  id: number
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

function formatDate(value: string) {
  return new Date(value).toLocaleString()
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
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          {ticket.error instanceof ApiError ? ticket.error.message : 'Could not load the ticket.'}
        </AlertDescription>
      </Alert>
    )
  }

  const t = ticket.data
  return (
    <article aria-labelledby="ticket-subject" className={columnsClass}>
      <div className="min-w-0">
        <header className="mb-6">
          <p className="text-sm text-muted-foreground">#{t.id}</p>
          <h1 id="ticket-subject" className="mb-3 text-2xl font-semibold break-words">
            {t.subject}
          </h1>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
            <dt className="text-muted-foreground">Submitter</dt>
            <dd className="min-w-0 break-words">
              {t.submitterName ? `${t.submitterName} <${t.submitterEmail}>` : t.submitterEmail}
            </dd>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="capitalize">{t.source}</dd>
            <dt className="text-muted-foreground">Received</dt>
            <dd>
              <time dateTime={t.createdAt}>{formatDate(t.createdAt)}</time>
            </dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>
              <time dateTime={t.updatedAt}>{formatDate(t.updatedAt)}</time>
            </dd>
          </dl>
        </header>

        <section aria-labelledby="ticket-messages">
          <h2 id="ticket-messages" className="mb-3 text-lg font-semibold">
            Messages
          </h2>
          {t.messages.length === 0 ? (
            <p className="text-muted-foreground">No messages.</p>
          ) : (
            <ol className="grid gap-4">
              {t.messages.map((message) => (
                <li key={message.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{message.senderName ?? message.senderEmail}</CardTitle>
                      <CardDescription>
                        {message.senderName && <>{message.senderEmail} · </>}
                        <time dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Bodies are plain text, so keep the email's line breaks. */}
                      <p className="text-sm break-words whitespace-pre-wrap">{message.body}</p>
                      {message.attachmentNames.length > 0 && (
                        <ul aria-label="Attachments" className="mt-4 flex flex-wrap gap-2">
                          {message.attachmentNames.map((name, i) => (
                            <li key={`${name}-${i}`}>
                              <Badge variant="outline">
                                <Paperclip />
                                {name}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Stays in view while scrolling a long thread. */}
      <aside aria-label="Ticket properties" className="lg:sticky lg:top-6 lg:self-start">
        <Card size="sm">
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <div className="grid gap-1.5">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <TicketStatusSelect ticketId={t.id} status={t.status} />
                </dd>
              </div>
              <div className="grid gap-1.5">
                <dt className="text-muted-foreground">Category</dt>
                <dd>
                  <TicketCategorySelect ticketId={t.id} category={t.category} />
                </dd>
              </div>
              <div className="grid gap-1.5">
                <dt className="text-muted-foreground">Assignee</dt>
                <dd>
                  <TicketAssignee ticketId={t.id} assignee={t.assignee} canAssign={canAssign} />
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
