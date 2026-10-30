import { Loader2, Sparkles } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { useSummarizeTicket } from './useSummarizeTicket'

// An on-demand AI summary of the ticket; each click regenerates it from the current messages.
// AI output is marked with the sun accent.
export function TicketSummary({ ticket }: { ticket: TicketDetailData }) {
  const summarize = useSummarizeTicket(ticket)

  return (
    <section aria-label="Summary" className="mb-8 grid gap-4">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ticket.messages.length === 0 || summarize.isPending}
          onClick={() => summarize.mutate()}
        >
          {summarize.isPending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-sun" />}
          {summarize.isPending ? 'Summarizing…' : 'Summarize'}
        </Button>
      </div>
      {summarize.isError && (
        <ErrorAlert>{errorMessage(summarize.error, 'Could not summarize the ticket.')}</ErrorAlert>
      )}
      {summarize.isSuccess && (
        <div className="rounded-r-2xl border-l-4 border-sun bg-sun/10 px-5 py-4">
          <h3 className="mb-1 flex items-center gap-2 font-heading font-semibold">
            <Sparkles className="size-4 text-sun" />
            Summary
          </h3>
          <p className="break-words whitespace-pre-wrap">{summarize.data}</p>
        </div>
      )}
    </section>
  )
}
