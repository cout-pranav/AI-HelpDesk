import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { categoryLabels, ticketCategories } from './ticketDisplay'
import { useUpdateTicket } from './useUpdateTicket'

const UNCATEGORIZED = ''

// Saves as soon as a category is picked; Uncategorized clears it.
export function TicketCategorySelect({ ticket }: { ticket: TicketDetailData }) {
  const update = useUpdateTicket(ticket.id, 'category')
  const errorText = update.error
    ? errorMessage(update.error, 'Could not update the category.')
    : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        className="w-full"
        aria-label="Category"
        aria-busy={update.isPending || undefined}
        aria-invalid={errorText ? true : undefined}
        value={ticket.category ?? UNCATEGORIZED}
        disabled={update.isPending}
        onChange={(e) =>
          update.mutate({ category: e.target.value === UNCATEGORIZED ? null : e.target.value })
        }
      >
        <NativeSelectOption value={UNCATEGORIZED}>Uncategorized</NativeSelectOption>
        {ticketCategories.map((c) => (
          <NativeSelectOption key={c} value={c}>
            {categoryLabels[c]}
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
