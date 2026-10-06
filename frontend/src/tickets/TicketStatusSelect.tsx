import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ApiError } from '@/lib/api'
import { ticketStatuses, type TicketStatus } from './ticketDisplay'
import { useUpdateTicket } from './useUpdateTicket'

// Saves as soon as a status is picked; any status can follow any other.
export function TicketStatusSelect({
  ticketId,
  status,
}: {
  ticketId: number
  status: TicketStatus
}) {
  const update = useUpdateTicket(ticketId, 'status')
  const errorMessage = update.error
    ? update.error instanceof ApiError
      ? update.error.message
      : 'Could not update the status.'
    : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        className="w-full"
        aria-label="Status"
        aria-busy={update.isPending || undefined}
        aria-invalid={errorMessage ? true : undefined}
        value={status}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ status: e.target.value })}
      >
        {ticketStatuses.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s}
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
