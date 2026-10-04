import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { EditUserDialog } from './EditUserDialog'
import type { UserListItem } from './UsersList'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { put: vi.fn() } }
})

const putMock = vi.mocked(api.put)

const grace: UserListItem = {
  id: 3,
  email: 'grace@example.com',
  displayName: 'Grace Agent',
  role: 'Agent',
  isActive: true,
  createdAt: '2026-10-03T09:00:00Z',
}

async function openDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<EditUserDialog user={grace} />)
  await user.click(screen.getByRole('button', { name: 'Edit Grace Agent' }))
  await screen.findByRole('dialog', { name: 'Edit user' })
  return user
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
}

describe('EditUserDialog', () => {
  beforeEach(() => {
    putMock.mockReset()
  })

  it('opens with the user’s name and email filled in and the passwords blank', async () => {
    await openDialog()

    expect(screen.getByLabelText('Name')).toHaveValue('Grace Agent')
    expect(screen.getByLabelText('Email')).toHaveValue('grace@example.com')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Leave blank to keep the current password.',
    )
    expect(screen.getByLabelText('Confirm password')).toHaveValue('')
  })

  it('leaves the password out when it is blank', async () => {
    putMock.mockResolvedValue({ data: grace } as AxiosResponse<UserListItem>)
    const user = await openDialog()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), ' Grace Hopper ')

    await save(user)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/users/3', {
      displayName: 'Grace Hopper',
      email: 'grace@example.com',
      password: undefined,
    })
  })

  it('sends a new password when one is entered and confirmed', async () => {
    putMock.mockResolvedValue({ data: grace } as AxiosResponse<UserListItem>)
    const user = await openDialog()
    await user.type(screen.getByLabelText('Password'), 'newpassword1')
    await user.type(screen.getByLabelText('Confirm password'), 'newpassword1')

    await save(user)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(putMock).toHaveBeenCalledExactlyOnceWith('/api/users/3', {
      displayName: 'Grace Agent',
      email: 'grace@example.com',
      password: 'newpassword1',
    })
  })

  it('requires the confirmation to match a new password', async () => {
    const user = await openDialog()
    await user.type(screen.getByLabelText('Password'), 'newpassword1')

    await save(user)

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(putMock).not.toHaveBeenCalled()
  })

  it('rejects a new password that is too short', async () => {
    const user = await openDialog()
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.type(screen.getByLabelText('Confirm password'), 'short')

    await save(user)

    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(putMock).not.toHaveBeenCalled()
  })

  it('validates name and email', async () => {
    const user = await openDialog()
    await user.clear(screen.getByLabelText('Name'))
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')

    await save(user)

    expect(await screen.findByText('Name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(putMock).not.toHaveBeenCalled()
  })

  it('shows a duplicate email on the email field and keeps the dialog open', async () => {
    putMock.mockRejectedValue(new ApiError(409, 'A user with this email already exists.'))
    const user = await openDialog()

    await save(user)

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows other API errors in an alert', async () => {
    putMock.mockRejectedValue(new ApiError(404, 'User not found.'))
    const user = await openDialog()

    await save(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('User not found.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('discards unsaved changes when cancelled and reopened', async () => {
    const user = await openDialog()
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Someone Else')
    await user.type(screen.getByLabelText('Password'), 'newpassword1')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Edit Grace Agent' }))

    expect(await screen.findByLabelText('Name')).toHaveValue('Grace Agent')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(putMock).not.toHaveBeenCalled()
  })
})
