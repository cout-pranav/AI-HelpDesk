import { useMutation } from '@tanstack/react-query'
import { polishReply } from '@/lib/ai'
import type { TicketDetailData } from '@/types/ticket'

// Rewrites a reply draft with AI, greeting the submitter and signing it with agentName;
// nothing is saved, so no queries change.
export function usePolishReply(ticket: TicketDetailData, agentName: string) {
  return useMutation({
    mutationFn: (draft: string) =>
      polishReply({ draft, subject: ticket.subject, customerName: ticket.submitterName, agentName }),
  })
}
