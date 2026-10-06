import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import {
  SEARCH_DEBOUNCE_MS,
  TICKETS_PAGE_SIZE,
  TicketsList,
  UNCATEGORIZED,
  type TicketListItem,
  type TicketListResponse,
} from './TicketsList'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

// Subjects are router links, so the list needs a router around it.
function renderList() {
  return renderWithQueryClient(
    <MemoryRouter>
      <TicketsList />
    </MemoryRouter>,
  )
}

function respondWith(response: Partial<TicketListResponse> & { items: TicketListItem[] }) {
  const data: TicketListResponse = {
    page: 1,
    pageSize: TICKETS_PAGE_SIZE,
    totalCount: response.items.length,
    ...response,
  }
  getMock.mockResolvedValue({ data } as AxiosResponse<TicketListResponse>)
}

// Newest first, as the API returns them.
const tickets: TicketListItem[] = [
  {
    id: 2,
    subject: 'Refund for duplicate charge',
    status: 'Open',
    category: 'RefundRequest',
    source: 'email',
    submitterEmail: 'jane@example.com',
    submitterName: 'Jane Student',
    createdAt: '2026-10-05T14:30:00Z',
    updatedAt: '2026-10-05T14:30:00Z',
  },
  {
    id: 1,
    subject: 'Cannot log in',
    status: 'Resolved',
    category: null,
    source: 'email',
    submitterEmail: 'bob@example.com',
    submitterName: null,
    createdAt: '2026-10-01T09:00:00Z',
    updatedAt: '2026-10-02T09:00:00Z',
  },
]

describe('TicketsList', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('fetches the first page of tickets', async () => {
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/tickets', {
      params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'createdAt', sortDir: 'desc' },
    })
  })

  it('shows a busy skeleton table while loading', () => {
    getMock.mockReturnValue(new Promise(() => {}))

    renderList()

    const table = screen.getByRole('table', { name: 'Loading tickets…' })
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'ID',
      'Subject',
      'Submitter',
      'Status',
      'Category',
      'Received',
    ])
    // Header row + 5 placeholder rows.
    expect(within(table).getAllByRole('row')).toHaveLength(6)
  })

  it('renders tickets in the order the API returns them (newest first)', async () => {
    respondWith({ items: tickets })

    renderList()

    const table = await screen.findByRole('table', { name: 'Tickets' })
    const [, ...bodyRows] = within(table).getAllByRole('row')
    expect(bodyRows).toHaveLength(2)

    expect(within(bodyRows[0]).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      '#2',
      'Refund for duplicate charge',
      'Jane Studentjane@example.com',
      'Open',
      'Refund request',
      new Date(tickets[0].createdAt).toLocaleString(),
    ])
    // No submitter name falls back to the email; no category shows "Uncategorized".
    expect(within(bodyRows[1]).getAllByRole('cell').map((td) => td.textContent)).toEqual([
      '#1',
      'Cannot log in',
      'bob@example.com',
      'Resolved',
      'Uncategorized',
      new Date(tickets[1].createdAt).toLocaleString(),
    ])
  })

  it('links each subject to its ticket detail page', async () => {
    respondWith({ items: tickets })

    renderList()

    const table = await screen.findByRole('table', { name: 'Tickets' })
    expect(within(table).getByRole('link', { name: 'Refund for duplicate charge' })).toHaveAttribute(
      'href',
      '/tickets/2',
    )
    expect(within(table).getByRole('link', { name: 'Cannot log in' })).toHaveAttribute(
      'href',
      '/tickets/1',
    )
  })

  it('pages through tickets with Previous and Next', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })

    renderList()

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' })
    expect(pagination).toHaveTextContent('Showing 1–2 of 27')
    expect(pagination).toHaveTextContent('Page 1 of 2')
    expect(within(pagination).getByRole('button', { name: 'Previous' })).toBeDisabled()

    respondWith({ items: [tickets[1]], page: 2, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.click(within(pagination).getByRole('button', { name: 'Next' }))

    expect(await within(pagination).findByText('Page 2 of 2')).toBeInTheDocument()
    expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
      params: { page: 2, pageSize: TICKETS_PAGE_SIZE, sortBy: 'createdAt', sortDir: 'desc' },
    })
    expect(pagination).toHaveTextContent('Showing 26–26 of 27')
    expect(within(pagination).getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(within(pagination).getByRole('button', { name: 'Previous' })).toBeEnabled()
  })

  it('shows sortable column headers, sorted by Received (newest first) by default', async () => {
    respondWith({ items: tickets })

    renderList()

    const table = await screen.findByRole('table', { name: 'Tickets' })
    const headers = within(table).getAllByRole('columnheader')
    expect(headers.map((th) => within(th).getByRole('button').textContent)).toEqual([
      'ID',
      'Subject',
      'Submitter',
      'Status',
      'Category',
      'Received',
    ])
    expect(within(table).getByRole('columnheader', { name: 'Received' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(within(table).getByRole('columnheader', { name: 'Subject' })).not.toHaveAttribute(
      'aria-sort',
    )
  })

  it('asks the API to sort by a column when its header is clicked, toggling direction', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    const table = await screen.findByRole('table', { name: 'Tickets' })
    await user.click(within(table).getByRole('button', { name: 'Subject' }))

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'subject', sortDir: 'asc' },
      }),
    )
    const subjectHeader = within(table).getByRole('columnheader', { name: 'Subject' })
    expect(subjectHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(within(table).getByRole('columnheader', { name: 'Received' })).not.toHaveAttribute(
      'aria-sort',
    )

    await user.click(within(table).getByRole('button', { name: 'Subject' }))

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'subject', sortDir: 'desc' },
      }),
    )
    expect(subjectHeader).toHaveAttribute('aria-sort', 'descending')
  })

  it('renders rows in the order the API returns for the chosen sort', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    const table = await screen.findByRole('table', { name: 'Tickets' })
    respondWith({ items: [tickets[1], tickets[0]] })
    await user.click(within(table).getByRole('button', { name: 'ID' }))

    await vi.waitFor(() => {
      const [, ...bodyRows] = within(table).getAllByRole('row')
      expect(bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
        '#1',
        '#2',
      ])
    })
  })

  it('goes back to the first page when the sort order changes', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })

    renderList()

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' })
    respondWith({ items: [tickets[1]], page: 2, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.click(within(pagination).getByRole('button', { name: 'Next' }))
    expect(await within(pagination).findByText('Page 2 of 2')).toBeInTheDocument()

    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.click(screen.getByRole('button', { name: 'Status' }))

    expect(await within(pagination).findByText('Page 1 of 2')).toBeInTheDocument()
    expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
      params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'status', sortDir: 'asc' },
    })
  })

  it('shows status and category filters, unfiltered by default', async () => {
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    const status = screen.getByRole('combobox', { name: 'Status' })
    const category = screen.getByRole('combobox', { name: 'Category' })
    expect(status).toHaveValue('')
    expect(category).toHaveValue('')
    expect(within(status).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All statuses',
      'Open',
      'Resolved',
      'Closed',
    ])
    expect(within(category).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All categories',
      'General question',
      'Technical question',
      'Refund request',
      'Uncategorized',
    ])
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('asks the API for the chosen status and category', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Resolved')

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: {
          page: 1,
          pageSize: TICKETS_PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
          status: 'Resolved',
        },
      }),
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Uncategorized')

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: {
          page: 1,
          pageSize: TICKETS_PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
          status: 'Resolved',
          category: UNCATEGORIZED,
        },
      }),
    )
  })

  it('clears the filters', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Open')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Refund request')
    await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'createdAt', sortDir: 'desc' },
      }),
    )
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('goes back to the first page when a filter changes', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })

    renderList()

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' })
    respondWith({ items: [tickets[1]], page: 2, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.click(within(pagination).getByRole('button', { name: 'Next' }))
    expect(await within(pagination).findByText('Page 2 of 2')).toBeInTheDocument()

    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Open')

    expect(await within(pagination).findByText('Page 1 of 2')).toBeInTheDocument()
    expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
      params: {
        page: 1,
        pageSize: TICKETS_PAGE_SIZE,
        sortBy: 'createdAt',
        sortDir: 'desc',
        status: 'Open',
      },
    })
  })

  it('sends the trimmed search once typing pauses, not on every keystroke', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    const search = screen.getByRole('searchbox', { name: 'Search' })
    expect(search).toHaveValue('')
    await user.type(search, '  refund ')

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: {
          page: 1,
          pageSize: TICKETS_PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
          search: 'refund',
        },
      }),
    )
    // The initial load plus one search request.
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('does not search for whitespace only', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), '   ')
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100))

    expect(getMock).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('clears the search along with the other filters', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    const search = screen.getByRole('searchbox', { name: 'Search' })
    await user.type(search, '#2')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Open')
    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: {
          page: 1,
          pageSize: TICKETS_PAGE_SIZE,
          sortBy: 'createdAt',
          sortDir: 'desc',
          status: 'Open',
          search: '#2',
        },
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await vi.waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
        params: { page: 1, pageSize: TICKETS_PAGE_SIZE, sortBy: 'createdAt', sortDir: 'desc' },
      }),
    )
    expect(search).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('')
  })

  it('goes back to the first page when the search changes', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })

    renderList()

    const pagination = await screen.findByRole('navigation', { name: 'Pagination' })
    respondWith({ items: [tickets[1]], page: 2, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.click(within(pagination).getByRole('button', { name: 'Next' }))
    expect(await within(pagination).findByText('Page 2 of 2')).toBeInTheDocument()

    respondWith({ items: tickets, totalCount: TICKETS_PAGE_SIZE + 2 })
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'log in')

    expect(await within(pagination).findByText('Page 1 of 2')).toBeInTheDocument()
    expect(getMock).toHaveBeenLastCalledWith('/api/tickets', {
      params: {
        page: 1,
        pageSize: TICKETS_PAGE_SIZE,
        sortBy: 'createdAt',
        sortDir: 'desc',
        search: 'log in',
      },
    })
  })

  it('says when no tickets match the filters, and keeps the filters usable', async () => {
    const user = userEvent.setup()
    respondWith({ items: tickets })

    renderList()

    await screen.findByRole('table', { name: 'Tickets' })
    respondWith({ items: [] })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Closed')

    expect(await screen.findByText('No tickets match these filters.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('Closed')
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('shows an empty state when there are no tickets', async () => {
    respondWith({ items: [] })

    renderList()

    expect(await screen.findByText('No tickets yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the API error message when the request fails', async () => {
    getMock.mockRejectedValue(new ApiError(500, 'Something broke.'))

    renderList()

    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a generic message for non-API errors', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))

    renderList()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tickets.')
  })
})
