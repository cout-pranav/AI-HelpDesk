import { screen, within } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { makeTicket } from '@/test/ticketFixtures'
import { TicketProperties } from './TicketProperties'
import type { TicketAssigneeData } from '@/types/ticket'
import type { AssigneeOption } from '@/types/user'

// Keep the real ApiError and stub only the HTTP call (the assignee picker loads its options).
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

const alex: TicketAssigneeData = { id: 3, displayName: 'Alex Agent', email: 'alex@example.com' }

// Saving each field is covered by the TicketStatusSelect, TicketCategorySelect and TicketAssignee tests.
describe('TicketProperties', () => {
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue({
      data: [{ id: 3, displayName: 'Alex Agent', isActive: true }],
    } as AxiosResponse<AssigneeOption[]>)
  })

  it("shows the ticket's status, category and assignee in a labelled sidebar", () => {
    renderWithQueryClient(
      <TicketProperties
        ticket={makeTicket({ status: 'Resolved', category: 'RefundRequest', assignee: alex })}
        canAssign={false}
      />,
    )

    const sidebar = screen.getByRole('complementary', { name: 'Ticket properties' })
    expect(within(sidebar).getByRole('combobox', { name: 'Status' })).toHaveDisplayValue('Resolved')
    expect(within(sidebar).getByRole('combobox', { name: 'Category' })).toHaveDisplayValue(
      'Refund request',
    )
    // Without canAssign the assignee is plain text, not a picker.
    expect(within(sidebar).getByText('Alex Agent')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
  })

  it('shows Uncategorized and Unassigned when category and assignee are missing', () => {
    renderWithQueryClient(<TicketProperties ticket={makeTicket()} canAssign={false} />)

    expect(screen.getByRole('combobox', { name: 'Category' })).toHaveDisplayValue('Uncategorized')
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows an assignee picker when canAssign is set', async () => {
    renderWithQueryClient(<TicketProperties ticket={makeTicket({ assignee: alex })} canAssign />)

    expect(await screen.findByRole('combobox', { name: 'Assignee' })).toHaveDisplayValue(
      'Alex Agent',
    )
  })
})
