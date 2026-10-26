import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AssigneeOption } from '@/types/user'

// Everyone a ticket can be (or still is) assigned to, sorted by name. Open to agents too, unlike
// GET /api/users. Under ['users'] so user changes invalidate it.
export function useAssigneeOptions() {
  return useQuery({
    queryKey: ['users', 'assignees'],
    queryFn: () => api.get<AssigneeOption[]>('/api/users/assignees').then((r) => r.data),
  })
}
