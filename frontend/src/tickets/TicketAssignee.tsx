import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { api, ApiError } from '@/lib/api'
import type { TicketDetailData } from './TicketDetail'
import type { TicketAssigneeData } from './ticketDisplay'
import { useAssigneeOptions } from './useAssigneeOptions'

const UNASSIGNED = ''

// Admins pick the assignee from active users; everyone else just sees who it is.
export function TicketAssignee({
  ticketId,
  assignee,
  canAssign,
}: {
  ticketId: number
  assignee: TicketAssigneeData | null
  canAssign: boolean
}) {
  if (!canAssign) {
    return assignee ? (
      <>{assignee.displayName}</>
    ) : (
      <span className="text-muted-foreground">Unassigned</span>
    )
  }
  return <AssigneeSelect ticketId={ticketId} assignee={assignee} />
}

function AssigneeSelect({
  ticketId,
  assignee,
}: {
  ticketId: number
  assignee: TicketAssigneeData | null
}) {
  const queryClient = useQueryClient()
  const users = useAssigneeOptions()

  const assign = useMutation({
    mutationFn: (userId: number | null) =>
      api
        .put<TicketDetailData>(`/api/tickets/${ticketId}/assignee`, { userId })
        .then((r) => r.data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(['tickets', 'detail', ticketId], ticket)
      // List rows show the updated time, so refetch them; the detail is already current.
      void queryClient.invalidateQueries({
        queryKey: ['tickets'],
        predicate: (query) => query.queryKey[1] !== 'detail',
      })
    },
  })

  // The current assignee always has an option (even before users load, or if they were since
  // deactivated); the rest are the active users.
  const others = (users.data ?? []).filter((u) => u.isActive && u.id !== assignee?.id)

  const error = assign.error ?? users.error
  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : assign.error
        ? 'Could not assign the ticket.'
        : 'Could not load users.'
    : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        aria-label="Assignee"
        aria-busy={assign.isPending || users.isPending || undefined}
        aria-invalid={errorMessage ? true : undefined}
        value={assignee ? String(assignee.id) : UNASSIGNED}
        disabled={assign.isPending || users.isPending}
        onChange={(e) => assign.mutate(e.target.value === UNASSIGNED ? null : Number(e.target.value))}
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
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
