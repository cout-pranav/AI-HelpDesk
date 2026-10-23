import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TicketDetailData } from './TicketDetail'

// POST /api/tickets/{id}/replies returns the updated ticket, which replaces the cached detail;
// the reply bumps the ticket's updated time, so list rows are refetched.
export function useAddReply(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: { body: string }) =>
      api.post<TicketDetailData>(`/api/tickets/${ticketId}/replies`, body).then((r) => r.data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(['tickets', 'detail', ticketId], ticket)
      void queryClient.invalidateQueries({
        queryKey: ['tickets'],
        predicate: (query) => query.queryKey[1] !== 'detail',
      })
    },
  })
}
