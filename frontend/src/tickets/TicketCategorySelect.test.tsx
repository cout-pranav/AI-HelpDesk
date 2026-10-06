import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { TicketCategorySelect } from './TicketCategorySelect'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { put: vi.fn() } }
})

const putMock = vi.mocked(api.put)

describe('TicketCategorySelect', () => {
  beforeEach(() => {
    putMock.mockReset()
  })

  it('shows the current category, with Uncategorized first among the options', () => {
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category="TechnicalQuestion" />)

    const select = screen.getByRole('combobox', { name: 'Category' })
    expect(select).toHaveDisplayValue('Technical question')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Uncategorized',
      'General question',
      'Technical question',
      'Refund request',
    ])
  })

  it('shows Uncategorized when the ticket has no category', () => {
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category={null} />)

    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveDisplayValue('Uncategorized')
  })

  it('saves the picked category, disabling the select while it saves', async () => {
    const user = userEvent.setup()
    putMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category={null} />)

    const select = screen.getByRole('combobox', { name: 'Category' })
    await user.selectOptions(select, 'Refund request')

    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/category', {
      category: 'RefundRequest',
    })
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
  })

  it('clears the category with null when Uncategorized is picked', async () => {
    const user = userEvent.setup()
    putMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category="RefundRequest" />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'Uncategorized')

    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/category', { category: null })
  })

  it('shows the API error when saving fails', async () => {
    const user = userEvent.setup()
    putMock.mockRejectedValue(new ApiError(404, 'Ticket not found.'))
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category={null} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'General question')

    expect(await screen.findByRole('alert')).toHaveTextContent('Ticket not found.')
  })

  it('shows a generic error when the request fails without an API error', async () => {
    const user = userEvent.setup()
    putMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<TicketCategorySelect ticketId={42} category={null} />)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'General question')

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the category.')
  })
})
