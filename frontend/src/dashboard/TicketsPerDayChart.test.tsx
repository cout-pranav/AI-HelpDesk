import { screen, within } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { TicketsPerDay } from '@/types/ticket'
import { TicketsPerDayChart } from './TicketsPerDayChart'

// Keep the real ApiError (errorMessage checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function respondWith(days: TicketsPerDay[]) {
  getMock.mockResolvedValue({ data: days } as AxiosResponse<TicketsPerDay[]>)
}

// Recharts draws nothing at jsdom's zero size, so the numbers are checked through the table that
// screen readers get instead of the chart.
describe('TicketsPerDayChart', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it("requests the counts in the browser's time zone", async () => {
    respondWith([{ date: '2026-10-28', count: 1 }])
    renderWithQueryClient(<TicketsPerDayChart />)

    await screen.findByRole('table', { name: 'Tickets per day, last 30 days' })
    expect(getMock).toHaveBeenCalledWith('/api/dashboard/tickets-per-day', {
      params: { utcOffsetMinutes: -new Date().getTimezoneOffset() },
    })
  })

  it('shows a loading placeholder while the counts load', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<TicketsPerDayChart />)

    expect(screen.getByLabelText('Loading tickets per day')).toHaveAttribute('aria-busy', 'true')
  })

  it('lists each day with its count and shows the total', async () => {
    respondWith([
      { date: '2026-10-27', count: 4 },
      { date: '2026-10-28', count: 0 },
    ])
    renderWithQueryClient(<TicketsPerDayChart />)

    const table = await screen.findByRole('table', { name: 'Tickets per day, last 30 days' })
    // Dates are read as local days, so 2026-10-27 never shows as the 26th west of UTC. The date
    // format follows the runner's locale, so only the day number is checked.
    const days = within(table).getAllByRole('rowheader')
    expect(days).toHaveLength(2)
    expect(days[0]).toHaveTextContent(/\b27\b/)
    expect(days[1]).toHaveTextContent(/\b28\b/)
    expect(within(table).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['4', '0'])
    expect(screen.getByText(/4 tickets/)).toBeInTheDocument()
  })

  it('says so when there were no tickets', async () => {
    respondWith([
      { date: '2026-10-27', count: 0 },
      { date: '2026-10-28', count: 0 },
    ])
    renderWithQueryClient(<TicketsPerDayChart />)

    expect(await screen.findByText('No tickets in the last 30 days.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the API error when the counts fail to load', async () => {
    getMock.mockRejectedValue(new ApiError(500, 'Server exploded.'))
    renderWithQueryClient(<TicketsPerDayChart />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded.')
  })

  it('falls back to a generic message for a network error', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<TicketsPerDayChart />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tickets per day.')
  })
})
