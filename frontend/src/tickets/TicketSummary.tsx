import { Loader2, Sparkles } from 'lucide-react'
import { ErrorAlert } from '@/components/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'
import { useSummarizeTicket } from './useSummarizeTicket'

// An on-demand AI summary of the ticket; each click regenerates it from the current messages.
export function TicketSummary({ ticket }: { ticket: TicketDetailData }) {
  const summarize = useSummarizeTicket(ticket)

  return (
    <section aria-label="Summary" className="mb-6 grid gap-4">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={ticket.messages.length === 0 || summarize.isPending}
          onClick={() => summarize.mutate()}
        >
          {summarize.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {summarize.isPending ? 'Summarizing…' : 'Summarize'}
        </Button>
      </div>
      {summarize.isError && (
        <ErrorAlert>{errorMessage(summarize.error, 'Could not summarize the ticket.')}</ErrorAlert>
      )}
      {summarize.isSuccess && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm break-words whitespace-pre-wrap">{summarize.data}</p>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
