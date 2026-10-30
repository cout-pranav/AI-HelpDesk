import { describe, expect, it } from 'vitest'
import { greeting } from './greeting'

describe('greeting', () => {
  it.each([
    [3, 'Good evening'],
    [5, 'Good morning'],
    [11, 'Good morning'],
    [12, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('greets hour %i with %s', (hour, expected) => {
    expect(greeting(hour)).toBe(expected)
  })
})
