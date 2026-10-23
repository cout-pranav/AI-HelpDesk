import { screen, within } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { TicketDetail, type TicketDetailData } from './TicketDetail'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function respondWith(data: TicketDetailData) {
  getMock.mockResolvedValue({ data } as AxiosResponse<TicketDetailData>)
}

const ticket: TicketDetailData = {
  id: 42,
  subject: 'Refund for duplicate charge',
  status: 'Open',
  category: 'RefundRequest',
  source: 'email',
  submitterEmail: 'jane@example.com',
  submitterName: 'Jane Student',
  createdAt: '2026-10-05T14:30:00Z',
  updatedAt: '2026-10-05T15:00:00Z',
  assignee: { id: 3, displayName: 'Alex Agent', email: 'alex@example.com' },
  messages: [
    {
      id: 7,
      direction: 'inbound',
      senderEmail: 'jane@example.com',
      senderName: 'Jane Student',
      body: 'I was charged twice.\nPlease refund one.',
      attachmentNames: ['receipt.pdf', 'statement.png'],
      createdAt: '2026-10-05T14:30:00Z',
    },
  ],
}

describe('TicketDetail', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('fetches the ticket by id', async () => {
    respondWith(ticket)

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    await screen.findByRole('heading', {
      name: 'Refund for duplicate charge',
      level: 1,
    })
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42')
  })

  it('shows a busy skeleton while loading', () => {
    getMock.mockReturnValue(new Promise(() => {}))

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    expect(screen.getByLabelText('Loading ticket')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the ticket fields', async () => {
    respondWith(ticket)

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    await screen.findByRole('heading', {
      name: 'Refund for duplicate charge',
      level: 1,
    })
    expect(screen.getByText('#42')).toBeInTheDocument()
    const field = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling
    // Status and category are editable by everyone.
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveDisplayValue('Open')
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveDisplayValue('Refund request')
    // Without canAssign the assignee is plain text, not a picker.
    expect(field('Assignee')).toHaveTextContent('Alex Agent')
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
    expect(field('Submitter')).toHaveTextContent('Jane Student <jane@example.com>')
    expect(field('Source')).toHaveTextContent('email')
    expect(field('Received')).toHaveTextContent(new Date(ticket.createdAt).toLocaleString())
    expect(field('Updated')).toHaveTextContent(new Date(ticket.updatedAt).toLocaleString())
  })

  it('falls back to the email and Uncategorized when name and category are missing', async () => {
    respondWith({
      ...ticket,
      submitterName: null,
      category: null,
      assignee: null,
    })

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    await screen.findByRole('heading', {
      name: 'Refund for duplicate charge',
      level: 1,
    })
    const field = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling
    expect(field('Submitter')).toHaveTextContent(/^jane@example\.com$/)
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveDisplayValue('Uncategorized')
    expect(field('Assignee')).toHaveTextContent('Unassigned')
  })

  // How each message renders is covered by TicketThread.test.tsx.
  it('shows the fetched messages, followed by the reply form', async () => {
    respondWith(ticket)

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    const thread = await screen.findByRole('region', { name: 'Messages' })
    expect(within(thread).getByRole('listitem', { name: 'Message from Jane Student' })).toBeInTheDocument()
    expect(screen.getByRole('form', { name: 'Reply to customer' })).toBeInTheDocument()
  })

  it('shows an assignee picker when canAssign is set', async () => {
    respondWith(ticket)

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign />)

    expect(await screen.findByRole('combobox', { name: 'Assignee' })).toHaveDisplayValue(
      'Alex Agent',
    )
  })

  it('shows the API error message, e.g. when the ticket does not exist', async () => {
    getMock.mockRejectedValue(new ApiError(404, 'Ticket not found.'))

    renderWithQueryClient(<TicketDetail ticketId={999} canAssign={false} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found.')
  })

  it('shows a generic error when the request fails without an API error', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))

    renderWithQueryClient(<TicketDetail ticketId={42} canAssign={false} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the ticket.')
  })
})
