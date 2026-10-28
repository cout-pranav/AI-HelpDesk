import { screen, within } from '@testing-library/react'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { DashboardStats as DashboardStatsData } from '@/types/ticket'
import { DashboardStats } from './DashboardStats'
import { formatDuration } from './formatDuration'

// Keep the real ApiError (errorMessage checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn() } }
})

const getMock = vi.mocked(api.get)

function respondWith(stats: DashboardStatsData) {
  getMock.mockResolvedValue({ data: stats } as AxiosResponse<DashboardStatsData>)
}

async function statValue(label: string) {
  return within(await screen.findByRole('group', { name: label })).getByText(/./, { selector: 'p.text-3xl' })
}

describe('DashboardStats', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('requests the dashboard stats', async () => {
    respondWith({ totalTickets: 0, openTickets: 0, resolvedByAi: 0, averageResolutionSeconds: null })
    renderWithQueryClient(<DashboardStats />)

    await screen.findByRole('group', { name: 'Total tickets' })
    expect(getMock).toHaveBeenCalledWith('/api/dashboard')
  })

  it('shows a loading placeholder while the stats load', () => {
    getMock.mockReturnValue(new Promise(() => {}))
    renderWithQueryClient(<DashboardStats />)

    expect(screen.getByLabelText('Loading statistics')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows each statistic', async () => {
    respondWith({ totalTickets: 1200, openTickets: 35, resolvedByAi: 300, averageResolutionSeconds: 3 * 3600 + 5 * 60 })
    renderWithQueryClient(<DashboardStats />)

    expect(await statValue('Total tickets')).toHaveTextContent('1,200')
    expect(await statValue('Open tickets')).toHaveTextContent('35')
    expect(await statValue('Resolved by AI')).toHaveTextContent('300')
    expect(await statValue('Resolved by AI (%)')).toHaveTextContent('25%')
    expect(await statValue('Avg. resolution time')).toHaveTextContent('3h 5m')
  })

  it('shows a dash for the percentage and resolution time when there is nothing to measure', async () => {
    respondWith({ totalTickets: 0, openTickets: 0, resolvedByAi: 0, averageResolutionSeconds: null })
    renderWithQueryClient(<DashboardStats />)

    expect(await statValue('Total tickets')).toHaveTextContent('0')
    expect(await statValue('Resolved by AI (%)')).toHaveTextContent('—')
    expect(await statValue('Avg. resolution time')).toHaveTextContent('—')
  })

  it('shows the API error when the stats fail to load', async () => {
    getMock.mockRejectedValue(new ApiError(500, 'Server exploded.'))
    renderWithQueryClient(<DashboardStats />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Server exploded.')
  })

  it('falls back to a generic message for a network error', async () => {
    getMock.mockRejectedValue(new Error('Network Error'))
    renderWithQueryClient(<DashboardStats />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ticket statistics.')
  })
})

describe('formatDuration', () => {
  it.each([
    [42, '42s'],
    [59.6, '1m'],
    [12 * 60 + 30, '12m'],
    [3 * 3600 + 5 * 60, '3h 5m'],
    [2 * 86400 + 4 * 3600 + 59 * 60, '2d 4h'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })
})
