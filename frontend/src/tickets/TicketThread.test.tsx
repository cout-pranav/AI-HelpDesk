import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import type { TicketMessage } from '@/types/ticket'
import { TicketThread } from './TicketThread'

const customerMessage: TicketMessage = {
  id: 7,
  direction: 'inbound',
  senderEmail: 'jane@example.com',
  senderName: 'Jane Student',
  body: 'I was charged twice.\nPlease refund one.',
  attachmentNames: ['receipt.pdf', 'statement.png'],
  createdAt: '2026-10-05T14:30:00Z',
  deliveryStatus: null,
}

const reply: TicketMessage = {
  id: 9,
  direction: 'outbound',
  senderEmail: 'alex@example.com',
  senderName: 'Alex Agent',
  body: 'Refund issued.',
  attachmentNames: [],
  createdAt: '2026-10-06T10:00:00Z',
  deliveryStatus: 'sent',
}

// The thread's own items, not the attachment badges nested inside them.
function threadItems() {
  return within(screen.getByRole('region', { name: 'Messages' }))
    .getAllByRole('listitem')
    .filter((li) => li.parentElement?.tagName === 'OL')
}

describe('TicketThread', () => {
  it('shows a message when there are no messages', () => {
    renderWithQueryClient(<TicketThread ticket={makeTicket({ messages: [] })} />)

    expect(screen.getByText('No messages.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows each message in order with its sender, date, body and attachment names', () => {
    const followUp: TicketMessage = {
      ...customerMessage,
      id: 8,
      body: 'Any update?',
      attachmentNames: [],
      createdAt: '2026-10-06T09:00:00Z',
    }

    renderWithQueryClient(<TicketThread ticket={makeTicket({ messages: [customerMessage, followUp] })} />)

    const [first, second] = threadItems()
    expect(within(first).getByText('Jane Student')).toBeInTheDocument()
    expect(first).toHaveTextContent('jane@example.com')
    expect(first).toHaveTextContent(new Date(customerMessage.createdAt).toLocaleString())
    // Line breaks in the plain-text body are kept as-is.
    expect(
      within(first).getByText((_, el) => el?.textContent === 'I was charged twice.\nPlease refund one.'),
    ).toBeInTheDocument()
    const attachments = within(first).getByRole('list', { name: 'Attachments' })
    expect(
      within(attachments)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['receipt.pdf', 'statement.png'])
    expect(within(second).getByText('Any update?')).toBeInTheDocument()
    expect(within(second).queryByRole('list', { name: 'Attachments' })).not.toBeInTheDocument()
  })

  it('falls back to the email when the sender has no name', () => {
    const ticket = makeTicket({ messages: [{ ...customerMessage, senderName: null }] })
    renderWithQueryClient(<TicketThread ticket={ticket} />)

    const [message] = threadItems()
    expect(message).toHaveAccessibleName('Message from jane@example.com')
    expect(within(message).getByText('jane@example.com')).toBeInTheDocument()
  })

  it('labels agent replies and marks them with a Reply badge', () => {
    renderWithQueryClient(<TicketThread ticket={makeTicket({ messages: [customerMessage, reply] })} />)

    const items = threadItems()
    expect(items.map((li) => li.getAttribute('aria-label'))).toEqual([
      'Message from Jane Student',
      'Reply from Alex Agent',
    ])
    expect(within(items[0]).queryByText('Reply')).not.toBeInTheDocument()
    expect(within(items[1]).getByText('Reply')).toBeInTheDocument()
    expect(within(items[1]).getByText('Refund issued.')).toBeInTheDocument()
  })

  // Each delivery status is covered by ReplyDeliveryStatus.test.tsx.
  it('shows whether replies were emailed, but not on customer messages', () => {
    renderWithQueryClient(<TicketThread ticket={makeTicket({ messages: [customerMessage, reply] })} />)

    const [message, replyItem] = threadItems()
    expect(within(replyItem).getByText('Emailed')).toBeInTheDocument()
    expect(within(message).queryByText('Emailed')).not.toBeInTheDocument()
    expect(within(message).queryByText('Not emailed')).not.toBeInTheDocument()
  })
})
