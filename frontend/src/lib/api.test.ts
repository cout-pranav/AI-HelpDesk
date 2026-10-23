import { describe, expect, it } from 'vitest'
import { ApiError, errorMessage } from './api'

describe('errorMessage', () => {
  it("returns an ApiError's own message", () => {
    expect(errorMessage(new ApiError(404, 'Ticket not found.'), 'Fallback.')).toBe('Ticket not found.')
  })

  it('returns the fallback for any other error', () => {
    expect(errorMessage(new Error('Network Error'), 'Fallback.')).toBe('Fallback.')
    expect(errorMessage('boom', 'Fallback.')).toBe('Fallback.')
  })
})
