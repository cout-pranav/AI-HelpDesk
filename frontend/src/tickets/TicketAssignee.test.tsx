import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { TicketAssignee } from './TicketAssignee'
import type { TicketDetailData } from './TicketDetail'
import type { TicketAssigneeData } from './ticketDisplay'
import type { AssigneeOption } from './useAssigneeOptions'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP calls.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn(), put: vi.fn() } }
})

const getMock = vi.mocked(api.get)
const putMock = vi.mocked(api.put)

const users: AssigneeOption[] = [
  { id: 1, displayName: 'Ada Admin', isActive: true },
  { id: 3, displayName: 'Alex Agent', isActive: true },
  { id: 4, displayName: 'Inactive Agent', isActive: false },
]

const alex: TicketAssigneeData = { id: 3, displayName: 'Alex Agent', email: 'alex@example.com' }

function renderPicker(assignee: TicketAssigneeData | null) {
  return renderWithQueryClient(<TicketAssignee ticketId={42} assignee={assignee} canAssign />)
}

async function findLoadedPicker() {
  const select = await screen.findByRole('combobox', { name: 'Assignee' })
  await waitFor(() => expect(select).toBeEnabled())
  return select
}

describe('TicketAssignee', () => {
  beforeEach(() => {
    getMock.mockReset()
    putMock.mockReset()
    getMock.mockResolvedValue({ data: users } as AxiosResponse<AssigneeOption[]>)
  })

  it('shows plain text without a picker when the user cannot assign', () => {
    renderWithQueryClient(<TicketAssignee ticketId={42} assignee={alex} canAssign={false} />)

    expect(screen.getByText('Alex Agent')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(getMock).not.toHaveBeenCalled()
  })

  it('shows Unassigned as text when the user cannot assign and nobody is assigned', () => {
    renderWithQueryClient(<TicketAssignee ticketId={42} assignee={null} canAssign={false} />)

    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('lists Unassigned plus active users, selecting the current assignee', async () => {
    renderPicker(alex)

    const select = await findLoadedPicker()
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/users/assignees')
    expect(select).toHaveDisplayValue('Alex Agent')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Unassigned',
      'Alex Agent',
      'Ada Admin',
    ])
  })

  it('is disabled while users load, still showing the current assignee', () => {
    getMock.mockReturnValue(new Promise(() => {}))

    renderPicker(alex)

    const select = screen.getByRole('combobox', { name: 'Assignee' })
    expect(select).toBeDisabled()
    expect(select).toHaveAttribute('aria-busy', 'true')
    expect(select).toHaveDisplayValue('Alex Agent')
  })

  it('assigns the ticket to the picked user', async () => {
    const user = userEvent.setup()
    putMock.mockResolvedValue({ data: {} } as AxiosResponse<TicketDetailData>)
    renderPicker(null)

    await user.selectOptions(await findLoadedPicker(), 'Ada Admin')

    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/assignee', { userId: 1 })
  })

  it('unassigns the ticket when Unassigned is picked', async () => {
    const user = userEvent.setup()
    putMock.mockResolvedValue({ data: {} } as AxiosResponse<TicketDetailData>)
    renderPicker(alex)

    await user.selectOptions(await findLoadedPicker(), 'Unassigned')

    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/42/assignee', { userId: null })
  })

  it('shows the API error when assigning fails', async () => {
    const user = userEvent.setup()
    putMock.mockRejectedValue(new ApiError(400, 'Assignee must be an active user.'))
    renderPicker(null)

    await user.selectOptions(await findLoadedPicker(), 'Alex Agent')

    expect(await screen.findByRole('alert')).toHaveTextContent('Assignee must be an active user.')
  })

  it('shows an error when users cannot be loaded', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))

    renderPicker(null)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users.')
  })
})
