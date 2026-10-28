import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/authContext'
import type { AuthContextValue } from '@/auth/authContext'
import type { Role } from '@/types/auth'
import { AppLayout } from './AppLayout'

vi.mock('@/auth/authContext', () => ({ useAuth: vi.fn() }))

const useAuthMock = vi.mocked(useAuth)

function signInAs(role: Role) {
  useAuthMock.mockReturnValue({
    user: { id: 1, email: 'sam@example.com', displayName: 'Sam', role },
    logout: vi.fn(),
  } as unknown as AuthContextValue)
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout />
    </MemoryRouter>,
  )
  return within(screen.getByRole('navigation'))
}

describe('AppLayout', () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it('shows agents the dashboard and tickets links but not users', () => {
    signInAs('Agent')
    const nav = renderAt('/tickets')

    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(nav.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets')
    expect(nav.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument()
  })

  it('shows admins the dashboard, tickets and users links', () => {
    signInAs('Admin')
    const nav = renderAt('/')

    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual(['Dashboard', 'Tickets', 'Users'])
  })

  it('marks the dashboard link current only on the dashboard', () => {
    signInAs('Agent')
    const nav = renderAt('/')
    expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark the dashboard link current on other pages', () => {
    signInAs('Agent')
    const nav = renderAt('/tickets/42')

    expect(nav.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    expect(nav.getByRole('link', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page')
  })
})
