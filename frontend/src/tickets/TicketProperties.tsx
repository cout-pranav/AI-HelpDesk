import { TicketAssignee } from './TicketAssignee'
import { TicketCategorySelect } from './TicketCategorySelect'
import type { TicketDetailData } from '@/types/ticket'
import { TicketStatusSelect } from './TicketStatusSelect'

// The editable fields beside the thread; each saves as soon as it changes.
// canAssign shows an assignee picker instead of plain text (admins only; the API enforces it too).
export function TicketProperties({
  ticket,
  canAssign,
}: {
  ticket: TicketDetailData
  canAssign: boolean
}) {
  // Sticky below the app header so it stays in view while scrolling a long thread.
  return (
    <aside
      aria-label="Ticket properties"
      className="rounded-2xl bg-muted p-4 lg:sticky lg:top-24 lg:self-start"
    >
      <dl className="grid gap-4 text-sm">
        <div className="grid gap-1.5">
          <dt>Status</dt>
          <dd>
            <TicketStatusSelect ticket={ticket} />
          </dd>
        </div>
        <div className="grid gap-1.5">
          <dt>Category</dt>
          <dd>
            <TicketCategorySelect ticket={ticket} />
          </dd>
        </div>
        <div className="grid gap-1.5">
          <dt>Assignee</dt>
          <dd>
            <TicketAssignee ticket={ticket} canAssign={canAssign} />
          </dd>
        </div>
      </dl>
    </aside>
  )
}
