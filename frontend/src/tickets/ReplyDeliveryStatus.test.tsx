import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import type { MessageDeliveryStatus, TicketDetailData, TicketMessage } from '@/types/ticket'
import { ReplyDeliveryStatus } from './ReplyDeliveryStatus'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

const postMock = vi.mocked(api.post)

function makeReply(deliveryStatus: MessageDeliveryStatus | null): TicketMessage {
  return {
    id: 9,
    direction: 'outbound',
    senderEmail: 'alex@example.com',
    senderName: 'Alex Agent',
    body: 'Refund issued.',
    attachmentNames: [],
    createdAt: '2026-10-06T10:00:00Z',
    deliveryStatus,
  }
}

function renderStatus(deliveryStatus: MessageDeliveryStatus | null) {
  return renderWithQueryClient(<ReplyDeliveryStatus ticketId={42} message={makeReply(deliveryStatus)} />)
}

describe('ReplyDeliveryStatus', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it.each([
    ['pending', 'Sending email…'],
    ['sent', 'Emailed'],
    [null, 'Not emailed'],
  ] as const)('shows %s replies as "%s" with no Resend button', (status, label) => {
    renderStatus(status)

    expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resend' })).not.toBeInTheDocument()
  })

  it('shows a failed email with a Resend button', () => {
    renderStatus('failed')

    expect(screen.getByText('Email failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend' })).toBeEnabled()
  })

  it('resends the reply and disables the button while it does', async () => {
    let resolve!: (value: AxiosResponse<TicketDetailData>) => void
    postMock.mockReturnValue(new Promise((r) => (resolve = r)))
    renderStatus('failed')

    await userEvent.click(screen.getByRole('button', { name: 'Resend' }))

    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/replies/9/resend')
    expect(screen.getByRole('button', { name: 'Resend' })).toBeDisabled()
    resolve({ data: makeTicket() } as AxiosResponse<TicketDetailData>)
  })

  it('shows the API error when the resend fails', async () => {
    postMock.mockRejectedValue(new ApiError(409, 'Only a reply that failed to send can be resent.'))
    renderStatus('failed')

    await userEvent.click(screen.getByRole('button', { name: 'Resend' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Only a reply that failed to send can be resent.')
    expect(screen.getByRole('button', { name: 'Resend' })).toBeEnabled()
  })

  it('shows a generic error when the resend fails without an API error', async () => {
    postMock.mockRejectedValue(new Error('Network Error'))
    renderStatus('failed')

    await userEvent.click(screen.getByRole('button', { name: 'Resend' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not resend the email.')
  })
})
