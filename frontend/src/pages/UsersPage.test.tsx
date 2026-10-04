import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import type { UserListItem } from '@/users/UsersList'
import { UsersPage } from './UsersPage'

// Keep the real ApiError and stub only the HTTP calls the page makes.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { get: vi.fn(), post: vi.fn() } }
})

const getMock = vi.mocked(api.get)

async function renderPageAndOpenDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<UsersPage />)
  await user.click(screen.getByRole('button', { name: 'Add user' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add user' })
  return { user, dialog }
}

async function expectDialogClosed() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('UsersPage', () => {
  beforeEach(() => {
    getMock.mockReset()
    getMock.mockResolvedValue({ data: [] } as unknown as AxiosResponse<UserListItem[]>)
  })

  it('does not show the add user dialog until the button is clicked', () => {
    renderWithQueryClient(<UsersPage />)

    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the add user dialog when Add user is clicked', async () => {
    const { dialog } = await renderPageAndOpenDialog()

    expect(dialog).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('closes the dialog when clicking outside of it', async () => {
    const { user } = await renderPageAndOpenDialog()

    // The backdrop covers everything outside the popup.
    const backdrop = document.querySelector('[data-slot="dialog-overlay"]')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop!)

    await expectDialogClosed()
  })

  it('closes the dialog when Escape is pressed', async () => {
    const { user } = await renderPageAndOpenDialog()

    await user.keyboard('{Escape}')

    await expectDialogClosed()
  })

  it('closes the dialog with the X button', async () => {
    const { user } = await renderPageAndOpenDialog()

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await expectDialogClosed()
  })

  it('closes the dialog with the Cancel button', async () => {
    const { user } = await renderPageAndOpenDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await expectDialogClosed()
  })

  it('stays open when clicking inside the dialog on anything other than a button', async () => {
    const { user, dialog } = await renderPageAndOpenDialog()

    await user.click(screen.getByText('Add user', { selector: 'h2' }))
    await user.click(screen.getByLabelText('Name'))

    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Add user' })).toBeInTheDocument()
  })
})
