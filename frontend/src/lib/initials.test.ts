import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('takes the first letters of the first and last words', () => {
    expect(initials('Jane Q Doe')).toBe('JD')
  })

  it('uses one letter for a single name', () => {
    expect(initials('admin')).toBe('A')
  })

  it('falls back to a question mark for a blank name', () => {
    expect(initials('   ')).toBe('?')
  })
})
