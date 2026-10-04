import { screen, within } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { UsersList, type UserListItem } from './UsersList'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function respondWith(data: UserListItem[]) {
  getMock.mockResolvedValue({ data } as AxiosResponse<UserListItem[]>)
}

const users: UserListItem[] = [
  {
    id: 1,
    email: 'admin@example.com',
    displayName: 'Ada Admin',
    role: 'Admin',
    isActive: true,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 2,
    email: 'agent@example.com',
    displayName: 'Alan Agent',
    role: 'Agent',
    isActive: false,
    createdAt: '2026-03-02T08:30:00Z',
  },
]

describe('UsersList', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('fetches users from /api/users', async () => {
    respondWith(users)

    renderWithQueryClient(<UsersList />)

    await screen.findByRole('table', { name: 'Users' })
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/users')
  })

  it('shows a busy skeleton table while loading', () => {
    getMock.mockReturnValue(new Promise(() => {}))

    renderWithQueryClient(<UsersList />)

    const table = screen.getByRole('table', { name: 'Loading users…' })
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Name',
      'Email',
      'Role',
      'Status',
      'Created',
      'Actions',
    ])
    // Header row + 5 placeholder rows.
    expect(within(table).getAllByRole('row')).toHaveLength(6)
  })

  it('renders one row per user with their details', async () => {
    respondWith(users)

    renderWithQueryClient(<UsersList />)

    const table = await screen.findByRole('table', { name: 'Users' })
    expect(table).not.toHaveAttribute('aria-busy')
    const [, ...bodyRows] = within(table).getAllByRole('row')
    expect(bodyRows).toHaveLength(2)

    const adminCells = within(bodyRows[0]).getAllByRole('cell')
    expect(adminCells.map((td) => td.textContent)).toEqual([
      'Ada Admin',
      'admin@example.com',
      'Admin',
      'Active',
      new Date(users[0].createdAt).toLocaleDateString(),
      '',
    ])

    const agentCells = within(bodyRows[1]).getAllByRole('cell')
    expect(agentCells.map((td) => td.textContent)).toEqual([
      'Alan Agent',
      'agent@example.com',
      'Agent',
      'Inactive',
      new Date(users[1].createdAt).toLocaleDateString(),
      '',
    ])
  })

  it('has an edit button on every row, admins included', async () => {
    respondWith(users)

    renderWithQueryClient(<UsersList />)

    const table = await screen.findByRole('table', { name: 'Users' })
    const [, ...bodyRows] = within(table).getAllByRole('row')
    expect(within(bodyRows[0]).getByRole('button', { name: 'Edit Ada Admin' })).toBeInTheDocument()
    expect(within(bodyRows[1]).getByRole('button', { name: 'Edit Alan Agent' })).toBeInTheDocument()
  })

  it('shows an empty state when there are no users', async () => {
    respondWith([])

    renderWithQueryClient(<UsersList />)

    expect(await screen.findByText('No users found.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the API error message when the request fails', async () => {
    getMock.mockRejectedValue(new ApiError(403, 'You do not have access to users.'))

    renderWithQueryClient(<UsersList />)

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to users.')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a generic message for non-API errors', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))

    renderWithQueryClient(<UsersList />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load users.')
  })
})
