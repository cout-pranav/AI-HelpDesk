import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ApiError } from '@/lib/api'
import { categoryLabels, ticketCategories, type TicketCategory } from './ticketDisplay'
import { useUpdateTicket } from './useUpdateTicket'

const UNCATEGORIZED = ''

// Saves as soon as a category is picked; Uncategorized clears it.
export function TicketCategorySelect({
  ticketId,
  category,
}: {
  ticketId: number
  category: TicketCategory | null
}) {
  const update = useUpdateTicket(ticketId, 'category')
  const errorMessage = update.error
    ? update.error instanceof ApiError
      ? update.error.message
      : 'Could not update the category.'
    : null

  return (
    <div className="grid gap-1">
      <NativeSelect
        size="sm"
        className="w-full"
        aria-label="Category"
        aria-busy={update.isPending || undefined}
        aria-invalid={errorMessage ? true : undefined}
        value={category ?? UNCATEGORIZED}
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
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
