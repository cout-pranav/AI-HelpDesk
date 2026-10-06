import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { TicketDetailData } from './TicketDetail'
import { TicketStatusSelect } from './TicketStatusSelect'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { put: vi.fn() } }
})

const putMock = vi.mocked(api.put)

describe('TicketStatusSelect', () => {
  beforeEach(() => {
    putMock.mockReset()
  })

  it('shows the current status and every status as an option', () => {
    renderWithQueryClient(<TicketStatusSelect ticketId={42} status="Resolved" />)

    const select = screen.getByRole('combobox', { name: 'Status' })
    expect(select).toHaveDisplayValue('Resolved')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Open',
      'Resolved',
      'Closed',
    ])
  })

  it('saves the picked status, disabling the select while it saves', async () => {
    const user = userEvent.setup()
    putMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketStatusSelect ticketId={42} status="Closed" />)

    const select = screen.getByRole('combobox', { name: 'Status' })
    // Reopening is allowed.
    await user.selectOptions(select, 'Open')

    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/status', { status: 'Open' })
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
  })

  it('re-enables the select once saved', async () => {
    const user = userEvent.setup()
    putMock.mockResolvedValue({ data: {} } as AxiosResponse<TicketDetailData>)
    renderWithQueryClient(<TicketStatusSelect ticketId={42} status="Open" />)

    const select = screen.getByRole('combobox', { name: 'Status' })
    await user.selectOptions(select, 'Resolved')

    await vi.waitFor(() => expect(select).toBeEnabled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the API error when saving fails', async () => {
    const user = userEvent.setup()
    putMock.mockRejectedValue(new ApiError(404, 'Ticket not found.'))
    renderWithQueryClient(<TicketStatusSelect ticketId={42} status="Open" />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Resolved')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found.')
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a generic error when the request fails without an API error', async () => {
    const user = userEvent.setup()
    putMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<TicketStatusSelect ticketId={42} status="Open" />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'Resolved')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the status.')
  })
})
