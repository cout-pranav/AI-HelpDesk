import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketDetailData } from './TicketDetail'
import { TicketReplyForm } from './TicketReplyForm'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

const postMock = vi.mocked(api.post)

describe('TicketReplyForm', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('posts the trimmed reply, disabling the button while it sends', async () => {
    const user = userEvent.setup()
    postMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} />)

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
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    await vi.waitFor(() => expect(textbox).toHaveValue(''))
    expect(screen.getByRole('button', { name: 'Send reply' })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('rejects an empty or whitespace-only reply without calling the API', async () => {
    const user = userEvent.setup()
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(await screen.findByText('Reply cannot be empty.')).toBeInTheDocument()
    expect(textbox).toHaveAttribute('aria-invalid', 'true')

    await user.type(textbox, '   ')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(screen.getByText('Reply cannot be empty.')).toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('shows the API error message and keeps the draft when sending fails', async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValue(new ApiError(404, 'Ticket not found.'))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} />)

    const textbox = screen.getByRole('textbox', { name: 'Reply' })
    await user.type(textbox, 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found.')
    expect(textbox).toHaveValue('Refund issued.')
  })

  it('shows a generic error when the request fails without an API error', async () => {
    const user = userEvent.setup()
    postMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<TicketReplyForm ticket={makeTicket()} />)

    await user.type(screen.getByRole('textbox', { name: 'Reply' }), 'Refund issued.')
    await user.click(screen.getByRole('button', { name: 'Send reply' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the reply.')
  })
})
