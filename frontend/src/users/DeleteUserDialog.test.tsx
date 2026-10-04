import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { DeleteUserDialog } from './DeleteUserDialog'
import type { UserListItem } from './UsersList'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { delete: vi.fn() } }
})

const deleteMock = vi.mocked(api.delete)

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
  renderWithQueryClient(<DeleteUserDialog user={grace} />)
  await user.click(screen.getByRole('button', { name: 'Delete Grace Agent' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Delete user?' })
  return { user, dialog }
}

async function expectDialogClosed() {
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
}

describe('DeleteUserDialog', () => {
  beforeEach(() => {
    deleteMock.mockReset()
  })

  it('asks for confirmation naming the user', async () => {
    const { dialog } = await openDialog()

    expect(dialog).toHaveAccessibleDescription(
      'Grace Agent (grace@example.com) will lose access and be removed from the users list.',
    )
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('closes without deleting when cancelled', async () => {
    const { user } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await expectDialogClosed()
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('deletes the user and closes when confirmed', async () => {
    deleteMock.mockResolvedValue({ status: 204 } as AxiosResponse)
    const { user } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await expectDialogClosed()
    expect(deleteMock).toHaveBeenCalledExactlyOnceWith('/api/users/3')
  })

  it('shows the API error and stays open when the delete fails', async () => {
    deleteMock.mockRejectedValue(new ApiError(409, 'Admins cannot be deleted.'))
    const { user, dialog } = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Admins cannot be deleted.')
    expect(dialog).toBeInTheDocument()
  })

  it('clears the previous error when reopened', async () => {
    deleteMock.mockRejectedValue(new Error('Network Error'))
    const { user } = await openDialog()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete user. Please try again.')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await expectDialogClosed()
    await user.click(screen.getByRole('button', { name: 'Delete Grace Agent' }))

    await screen.findByRole('alertdialog')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
