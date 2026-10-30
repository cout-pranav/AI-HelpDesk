import type { TicketDetailData } from '@/types/ticket'
import { formatDate } from './ticketDisplay'

// The ticket's id, subject and read-only facts: who sent it, how, and when.
export function TicketDetailHeading({ ticket }: { ticket: TicketDetailData }) {
  return (
    <header className="mb-8">
      <p className="mb-1 text-sm text-muted-foreground">#{ticket.id}</p>
      {/* TicketDetail's <article> is labelled by this heading. */}
      <h1 id="ticket-subject" className="mb-4 text-4xl break-words">
        {ticket.subject}
      </h1>
      {/* One quiet row of facts, each label beside its value, wrapping on narrow screens. */}
      <dl className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
        <div className="flex min-w-0 gap-1.5">
          <dt>Submitter</dt>
          <dd className="min-w-0 break-words">
            {ticket.submitterName
              ? `${ticket.submitterName} <${ticket.submitterEmail}>`
              : ticket.submitterEmail}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Source</dt>
          <dd className="capitalize">{ticket.source}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Received</dt>
          <dd>
            <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time>
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Updated</dt>
          <dd>
            <time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
          </dd>
        </div>
      </dl>
    </header>
  )
}
