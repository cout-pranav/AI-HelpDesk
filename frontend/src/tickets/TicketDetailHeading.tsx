import type { TicketDetailData } from '@/types/ticket'
import { formatDate } from './ticketDisplay'

// The ticket's id, subject and read-only facts: who sent it, how, and when.
export function TicketDetailHeading({ ticket }: { ticket: TicketDetailData }) {
  return (
    <header className="mb-6">
      <p className="text-sm text-muted-foreground">#{ticket.id}</p>
      {/* TicketDetail's <article> is labelled by this heading. */}
      <h1 id="ticket-subject" className="mb-3 break-words">
        {ticket.subject}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr_auto_1fr]">
        <dt>Submitter</dt>
        <dd className="min-w-0 break-words">
          {ticket.submitterName
            ? `${ticket.submitterName} <${ticket.submitterEmail}>`
            : ticket.submitterEmail}
        </dd>
        <dt>Source</dt>
        <dd className="capitalize">{ticket.source}</dd>
        <dt>Received</dt>
        <dd>
          <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time>
        </dd>
        <dt>Updated</dt>
        <dd>
          <time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
        </dd>
      </dl>
    </header>
  )
}
