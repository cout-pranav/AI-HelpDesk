import { useMutation } from '@tanstack/react-query'
import { summarizeTicket } from '@/lib/ai'
import type { TicketDetailData } from '@/types/ticket'

// Summarizes the ticket and its messages with AI. A mutation rather than a query, so every
// click generates a fresh summary instead of reusing a cached one.
export function useSummarizeTicket(ticket: TicketDetailData) {
  return useMutation({
    mutationFn: () => summarizeTicket(ticket),
  })
}
