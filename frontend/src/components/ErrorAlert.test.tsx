import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ErrorAlert } from './ErrorAlert'

describe('ErrorAlert', () => {
  it('shows the message as an alert', () => {
    render(<ErrorAlert>Could not load tickets.</ErrorAlert>)

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load tickets.')
  })
})
