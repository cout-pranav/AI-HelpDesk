import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketDetailData } from '@/types/ticket'
import { useResendReply } from './useResendReply'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

const postMock = vi.mocked(api.post)

const detailKey = ['tickets', 'detail', 42]

function renderUseResendReply() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  queryClient.setQueryData(detailKey, makeTicket())
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return { queryClient, ...renderHook(() => useResendReply(42), { wrapper }) }
}

describe('useResendReply', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('posts to the reply\'s resend endpoint and caches the returned ticket', async () => {
    const updated = makeTicket({ updatedAt: '2026-10-06T09:00:00Z' })
    postMock.mockResolvedValue({ data: updated } as AxiosResponse<TicketDetailData>)
    const { result, queryClient } = renderUseResendReply()

    result.current.mutate(9)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/replies/9/resend')
    expect(queryClient.getQueryData(detailKey)).toEqual(updated)
  })

  it('leaves the cache alone when the resend fails', async () => {
    postMock.mockRejectedValue(new ApiError(409, 'Only a reply that failed to send can be resent.'))
    const { result, queryClient } = renderUseResendReply()

    result.current.mutate(9)

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError))
    expect(queryClient.getQueryData(detailKey)).toEqual(makeTicket())
  })
})
