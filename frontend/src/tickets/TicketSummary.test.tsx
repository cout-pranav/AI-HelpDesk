import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { summarizeTicket } from '@/lib/ai'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketMessage } from '@/types/ticket'
import { TicketSummary } from './TicketSummary'

vi.mock('@/lib/ai', () => ({ summarizeTicket: vi.fn() }))

const summarizeMock = vi.mocked(summarizeTicket)

const message: TicketMessage = {
  id: 1,
  direction: 'inbound',
  senderEmail: 'jane@example.com',
  senderName: 'Jane Student',
  body: 'I was charged twice.',
  attachmentNames: [],
  createdAt: '2026-10-05T14:30:00Z',
}
const ticket = makeTicket({ messages: [message] })

describe('TicketSummary', () => {
  beforeEach(() => {
    summarizeMock.mockReset()
  })

  it('shows only the Summarize button until it is clicked', () => {
    renderWithQueryClient(<TicketSummary ticket={ticket} />)

    expect(screen.getByRole('button', { name: 'Summarize' })).toBeEnabled()
    expect(screen.queryByText('Summary')).not.toBeInTheDocument()
    expect(summarizeMock).not.toHaveBeenCalled()
  })

  it('disables Summarize when the ticket has no messages', () => {
    renderWithQueryClient(<TicketSummary ticket={makeTicket()} />)

    expect(screen.getByRole('button', { name: 'Summarize' })).toBeDisabled()
  })

  it('summarizes the ticket, disabling the button meanwhile', async () => {
    const user = userEvent.setup()
    summarizeMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketSummary ticket={ticket} />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(summarizeMock).toHaveBeenCalledExactlyOnceWith(ticket)
    expect(screen.getByRole('button', { name: 'Summarizing…' })).toBeDisabled()
  })

  it('shows the summary', async () => {
    const user = userEvent.setup()
    summarizeMock.mockResolvedValue('Jane was charged twice and wants a refund.')
    renderWithQueryClient(<TicketSummary ticket={ticket} />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(await screen.findByText('Jane was charged twice and wants a refund.')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
  })

  it('generates a new summary on every click', async () => {
    const user = userEvent.setup()
    summarizeMock.mockResolvedValueOnce('First summary.').mockResolvedValueOnce('Second summary.')
    renderWithQueryClient(<TicketSummary ticket={ticket} />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))
    expect(await screen.findByText('First summary.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Summarize' }))
    expect(await screen.findByText('Second summary.')).toBeInTheDocument()
    expect(screen.queryByText('First summary.')).not.toBeInTheDocument()
    expect(summarizeMock).toHaveBeenCalledTimes(2)
  })

  it('shows an error when summarizing fails', async () => {
    const user = userEvent.setup()
    summarizeMock.mockRejectedValue(new Error('quota exceeded'))
    renderWithQueryClient(<TicketSummary ticket={ticket} />)

    await user.click(screen.getByRole('button', { name: 'Summarize' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not summarize the ticket.')
    expect(screen.getByRole('button', { name: 'Summarize' })).toBeEnabled()
  })
})
