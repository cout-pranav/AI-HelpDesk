import { screen } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/auth/authContext'
import { api } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { TicketDetailData } from '@/tickets/TicketDetail'
import { TicketDetailPage } from './TicketDetailPage'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function renderAt(path: string, role: 'Admin' | 'Agent' = 'Agent') {
  // The page only reads the signed-in user's role.
  const auth = {
    user: { id: 1, email: 'me@example.com', displayName: 'Me', role },
  } as AuthContextValue
  return renderWithQueryClient(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const ticket: TicketDetailData = {
  id: 5,
  subject: 'Cannot log in',
  status: 'Open',
  category: null,
  source: 'email',
  submitterEmail: 'bob@example.com',
  submitterName: null,
  createdAt: '2026-10-01T09:00:00Z',
  updatedAt: '2026-10-01T09:00:00Z',
  assignee: null,
  messages: [],
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('loads the ticket from the id in the URL and links back to the list', async () => {
    getMock.mockResolvedValue({ data: ticket } as AxiosResponse<TicketDetailData>)

    renderAt('/tickets/5')

    expect(await screen.findByRole('heading', { name: 'Cannot log in' })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/5')
    expect(screen.getByRole('link', { name: 'Back to tickets' })).toHaveAttribute(
      'href',
      '/tickets',
    )
  })

  it('lets admins pick the assignee but shows agents plain text', async () => {
    getMock.mockImplementation((url) =>
      Promise.resolve({ data: url === '/api/users/assignees' ? [] : ticket } as AxiosResponse),
    )

    const { unmount } = renderAt('/tickets/5', 'Admin')
    expect(await screen.findByRole('combobox', { name: 'Assignee' })).toBeInTheDocument()
    unmount()

    renderAt('/tickets/5', 'Agent')
    await screen.findByRole('heading', { name: 'Cannot log in' })
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).not.toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows not found without calling the API when the id is not a number', () => {
    renderAt('/tickets/abc')

    expect(screen.getByRole('alert')).toHaveTextContent('Ticket not found.')
    expect(getMock).not.toHaveBeenCalled()
  })
})
