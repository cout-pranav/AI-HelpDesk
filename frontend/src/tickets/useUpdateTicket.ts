import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { TicketDetailData } from './TicketDetail'

type TicketUpdates = {
  status: { status: string }
  category: { category: string | null }
  assignee: { userId: number | null }
}

// PUT /api/tickets/{id}/{field}. Each returns the updated ticket, which replaces the cached detail;
// list rows show these fields and the updated time, so they're refetched.
export function useUpdateTicket<F extends keyof TicketUpdates>(ticketId: number, field: F) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TicketUpdates[F]) =>
      api.put<TicketDetailData>(`/api/tickets/${ticketId}/${field}`, body).then((r) => r.data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(['tickets', 'detail', ticketId], ticket)
      void queryClient.invalidateQueries({
        queryKey: ['tickets'],
        predicate: (query) => query.queryKey[1] !== 'detail',
      })
    },
  })
}
