import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  it('draws the initials without adding text or an accessible name', () => {
    const { container } = render(<UserAvatar name="Jane Doe" />)

    const avatar = container.firstElementChild
    expect(avatar).toHaveAttribute('data-initials', 'JD')
    expect(avatar).toHaveAttribute('aria-hidden', 'true')
    expect(avatar).toHaveTextContent(/^$/)
  })
})
