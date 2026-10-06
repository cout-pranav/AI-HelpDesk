import { screen } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { TicketDetailData } from '@/tickets/TicketDetail'
import { TicketDetailPage } from './TicketDetailPage'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function renderAt(path: string) {
  return renderWithQueryClient(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('loads the ticket from the id in the URL and links back to the list', async () => {
    const data: TicketDetailData = {
      id: 5,
      subject: 'Cannot log in',
      status: 'Open',
      category: null,
      source: 'email',
      submitterEmail: 'bob@example.com',
      submitterName: null,
      createdAt: '2026-10-01T09:00:00Z',
      updatedAt: '2026-10-01T09:00:00Z',
      messages: [],
    }
    getMock.mockResolvedValue({ data } as AxiosResponse<TicketDetailData>)

    renderAt('/tickets/5')

    expect(await screen.findByRole('heading', { name: 'Cannot log in' })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledExactlyOnceWith('/api/tickets/5')
    expect(screen.getByRole('link', { name: 'Back to tickets' })).toHaveAttribute(
      'href',
      '/tickets',
    )
  })

  it('shows not found without calling the API when the id is not a number', () => {
    renderAt('/tickets/abc')

    expect(screen.getByRole('alert')).toHaveTextContent('Ticket not found.')
    expect(getMock).not.toHaveBeenCalled()
  })
})
