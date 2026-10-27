import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { polishReply } from '@/lib/ai'
import { makeTicket } from '@/test/ticketFixtures'
import { usePolishReply } from './usePolishReply'

vi.mock('@/lib/ai', () => ({ polishReply: vi.fn() }))

const polishMock = vi.mocked(polishReply)

function renderUsePolishReply(...args: Parameters<typeof usePolishReply>) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => usePolishReply(...args), { wrapper })
}

describe('usePolishReply', () => {
  beforeEach(() => {
    polishMock.mockReset()
  })

  it("polishes the draft with the ticket's subject and submitter and the agent's name", async () => {
    polishMock.mockResolvedValue('Hello Jane,')
    const { result } = renderUsePolishReply(makeTicket(), 'Alex Agent')

    result.current.mutate('refund is done')

    await waitFor(() => expect(result.current.data).toBe('Hello Jane,'))
    expect(polishMock).toHaveBeenCalledExactlyOnceWith({
      draft: 'refund is done',
      subject: 'Refund for duplicate charge',
      customerName: 'Jane Student',
      agentName: 'Alex Agent',
    })
  })

  it('passes a missing submitter name as null', async () => {
    polishMock.mockResolvedValue('Hello,')
    const { result } = renderUsePolishReply(makeTicket({ submitterName: null }), 'Alex Agent')

    result.current.mutate('refund is done')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(polishMock).toHaveBeenCalledWith(expect.objectContaining({ customerName: null }))
  })

  it('exposes the error when polishing fails', async () => {
    polishMock.mockRejectedValue(new Error('quota exceeded'))
    const { result } = renderUsePolishReply(makeTicket(), 'Alex Agent')

    result.current.mutate('refund is done')

    await waitFor(() => expect(result.current.error).toEqual(new Error('quota exceeded')))
  })
})
