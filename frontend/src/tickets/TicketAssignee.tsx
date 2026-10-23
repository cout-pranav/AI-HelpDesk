import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from './TicketDetail'
import { useAssigneeOptions } from './useAssigneeOptions'
import { useUpdateTicket } from './useUpdateTicket'

const UNASSIGNED = ''

// Admins pick the assignee from active users; everyone else just sees who it is.
export function TicketAssignee({
  ticket,
  canAssign,
}: {
  ticket: TicketDetailData
  canAssign: boolean
}) {
  if (!canAssign) {
    return ticket.assignee ? (
      <>{ticket.assignee.displayName}</>
    ) : (
      <span className="text-muted-foreground">Unassigned</span>
    )
  }
  return <AssigneeSelect ticket={ticket} />
}

function AssigneeSelect({ ticket }: { ticket: TicketDetailData }) {
  const { assignee } = ticket
  const users = useAssigneeOptions()
  const assign = useUpdateTicket(ticket.id, 'assignee')

  // The current assignee always has an option (even before users load, or if they were since
  // deactivated); the rest are the active users.
  const others = (users.data ?? []).filter((u) => u.isActive && u.id !== assignee?.id)

  const error = assign.error ?? users.error
  const errorText = error
    ? errorMessage(error, assign.error ? 'Could not assign the ticket.' : 'Could not load users.')
    : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        className="w-full"
        aria-label="Assignee"
        aria-busy={assign.isPending || users.isPending || undefined}
        aria-invalid={errorText ? true : undefined}
        value={assignee ? String(assignee.id) : UNASSIGNED}
        disabled={assign.isPending || users.isPending}
        onChange={(e) =>
          assign.mutate({ userId: e.target.value === UNASSIGNED ? null : Number(e.target.value) })
        }
      >
        <NativeSelectOption value={UNASSIGNED}>Unassigned</NativeSelectOption>
        {assignee && (
          <NativeSelectOption value={String(assignee.id)}>{assignee.displayName}</NativeSelectOption>
        )}
        {others.map((u) => (
          <NativeSelectOption key={u.id} value={String(u.id)}>
            {u.displayName}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {errorText && (
        <p role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      )}
    </div>
  )
}
