import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { polishReply } from '@/lib/ai'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketDetailData } from '@/types/ticket'
import { TicketReplyForm } from './TicketReplyForm'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

vi.mock('@/lib/ai', () => ({ polishReply: vi.fn() }))

const postMock = vi.mocked(api.post)
const polishMock = vi.mocked(polishReply)

describe('TicketReplyForm', () => {
  beforeEach(() => {
    postMock.mockReset()
    polishMock.mockReset()
  })

  it('disables Polish until there is a draft', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const polishButton = screen.getByRole('button', { name: 'Polish' })
    expect(polishButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reply' }), '   ')
    expect(polishButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'ok')
    expect(polishButton).toBeEnabled()
  })

  it('polishes the trimmed draft with the ticket subject, customer and agent names, disabling both buttons meanwhile', async () => {
    const user = userEvent.setup()
    polishMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    await user.type(screen.getByRole('textbox', { name: 'Reply' }), '  refund is done  ')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    expect(polishMock).toHaveBeenCalledExactlyOnceWith({
      draft: 'refund is done',
      subject: 'Refund for duplicate charge',
      customerName: 'Jane Student',
      agentName: 'Alex Agent',
    })
    expect(screen.getByRole('button', { name: 'Polishing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled()
  })

  it('replaces the draft with the polished reply without sending it', async () => {
    const user = userEvent.setup()
    polishMock.mockResolvedValue('Your refund has been processed.')
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'refund is done')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    await vi.waitFor(() => expect(textbox).toHaveValue('Your refund has been processed.'))
    expect(screen.getByRole('button', { name: 'Polish' })).toBeEnabled()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('shows an error and keeps the draft when polishing fails', async () => {
    const user = userEvent.setup()
    polishMock.mockRejectedValue(new Error('quota exceeded'))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'refund is done')
    await user.click(screen.getByRole('button', { name: 'Polish' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not polish the reply.')
    expect(textbox).toHaveValue('refund is done')
  })

  it('posts the trimmed reply, disabling the button while it sends', async () => {
    const user = userEvent.setup()
    postMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    await user.type(screen.getByRole('textbox', { name: 'Reply' }), '  Refund issued.  ')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/replies', {
      body: 'Refund issued.',
    })
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
  })

  it('clears the reply once it is saved', async () => {
    const user = userEvent.setup()
    postMock.mockResolvedValue({ data: {} } as AxiosResponse<TicketDetailData>)
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    await vi.waitFor(() => expect(textbox).toHaveValue(''))
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeDisabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('disables Send reply until there is a draft', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const sendButton = screen.getByRole('button', { name: 'Send reply' })
    expect(sendButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reply' }), '   ')
    expect(sendButton).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'ok')
    expect(sendButton).toBeEnabled()
  })

  it('shows the API error message and keeps the draft when sending fails', async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValue(new ApiError(404, 'Ticket not found.'))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found.')
    expect(textbox).toHaveValue('Refund issued.')
  })

  it('shows a generic error when the request fails without an API error', async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} agentName="Alex Agent" />)

    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the reply.')
  })
})
