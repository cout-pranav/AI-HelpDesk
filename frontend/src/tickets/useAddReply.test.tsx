import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketDetailData } from '@/types/ticket'
import { useAddReply } from './useAddReply'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

const postMock = vi.mocked(api.post)

const listKey = ['tickets', 'list', { page: 1 }]
const detailKey = ['tickets', 'detail', 42]

// Seeds a detail and a list query so the test can see which ones the reply touches.
function renderUseAddReply() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  queryClient.setQueryData(detailKey, makeTicket())
  queryClient.setQueryData(listKey, { items: [] })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...renderHook(() => useAddReply(42), { wrapper }) }
}

describe('useAddReply', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('posts the reply body to the ticket', async () => {
    postMock.mockResolvedValue({ data: makeTicket() } as AxiosResponse<TicketDetailData>)
    const { result } = renderUseAddReply()

    result.current.mutate({ body: 'Refund issued.' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/replies', {
      body: 'Refund issued.',
    })
  })

  it('caches the returned ticket and marks the list queries stale, but not the detail', async () => {
    const updated = makeTicket({ updatedAt: '2026-10-06T09:00:00Z' })
    postMock.mockResolvedValue({ data: updated } as AxiosResponse<TicketDetailData>)
    const { result, queryClient } = renderUseAddReply()

    result.current.mutate({ body: 'Refund issued.' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(detailKey)).toEqual(updated)
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(false)
  })

  it('leaves the cache alone when the reply fails', async () => {
    postMock.mockRejectedValue(new ApiError(400, 'Reply cannot be empty.'))
    const { result, queryClient } = renderUseAddReply()

    result.current.mutate({ body: '' })

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError))
    expect(queryClient.getQueryData(detailKey)).toEqual(makeTicket())
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false)
  })
})
