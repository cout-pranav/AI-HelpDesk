import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TicketDetailSkeleton } from './TicketDetailSkeleton'

describe('TicketDetailSkeleton', () => {
  it('is announced as a busy "Loading ticket" region', () => {
    render(<TicketDetailSkeleton />)

    expect(screen.getByLabelText('Loading ticket')).toHaveAttribute('aria-busy', 'true')
  })
})
