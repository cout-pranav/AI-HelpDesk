import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppErrorFallback } from './AppErrorFallback'

describe('AppErrorFallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('explains that something went wrong', () => {
    render(<AppErrorFallback />)

    expect(screen.getByRole('heading', { name: 'Something went wrong', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Reloading usually fixes it.')
  })

  it('reloads the page when Reload is clicked', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    render(<AppErrorFallback />)

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(reload).toHaveBeenCalledOnce()
  })
})
