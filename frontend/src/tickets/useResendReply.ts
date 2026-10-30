import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TicketDetailData } from '@/types/ticket'

// POST /api/tickets/{id}/replies/{messageId}/resend queues a reply whose email failed again and
// returns the updated ticket, which replaces the cached detail.
export function useResendReply(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (messageId: number) =>
      api
        .post<TicketDetailData>(`/api/tickets/${ticketId}/replies/${messageId}/resend`)
        .then((r) => r.data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(['tickets', 'detail', ticketId], ticket)
    },
  })
}
