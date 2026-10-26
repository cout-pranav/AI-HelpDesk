import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { ticketStatuses } from './ticketDisplay'
import { useUpdateTicket } from './useUpdateTicket'

// Saves as soon as a status is picked; any status can follow any other.
export function TicketStatusSelect({ ticket }: { ticket: TicketDetailData }) {
  const update = useUpdateTicket(ticket.id, 'status')
  const errorText = update.error ? errorMessage(update.error, 'Could not update the status.') : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        className="w-full"
        aria-label="Status"
        aria-busy={update.isPending || undefined}
        aria-invalid={errorText ? true : undefined}
        value={ticket.status}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ status: e.target.value })}
      >
        {ticketStatuses.map((s) => (
          <NativeSelectOption key={s} value={s}>
            {s}
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
