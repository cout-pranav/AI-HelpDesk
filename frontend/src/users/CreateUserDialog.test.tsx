import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosResponse } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/lib/api'
import { renderWithQueryClient } from '@/test/renderWithQueryClient'
import { CreateUserDialog } from './CreateUserDialog'
import type { UserListItem } from './UsersList'

// Keep the real ApiError (the component checks instanceof) and stub only the HTTP call.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, api: { post: vi.fn() } }
})

const postMock = vi.mocked(api.post)

const created: UserListItem = {
  id: 3,
  email: 'grace@example.com',
  displayName: 'Grace Agent',
  role: 'Agent',
  isActive: true,
  createdAt: '2026-10-03T09:00:00Z',
}

async function openDialog() {
  const user = userEvent.setup()
  renderWithQueryClient(<CreateUserDialog />)
  await user.click(screen.getByRole('button', { name: 'Add user' }))
  await screen.findByRole('dialog', { name: 'Add user' })
  return user
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values: { name: string; email: string; password: string; confirmPassword?: string },
) {
  // The confirmation matches the password unless a test says otherwise.
  const confirmPassword = values.confirmPassword ?? values.password
  if (values.name) await user.type(screen.getByLabelText('Name'), values.name)
  if (values.email) await user.type(screen.getByLabelText('Email'), values.email)
  if (values.password) await user.type(screen.getByLabelText('Password'), values.password)
  if (confirmPassword) await user.type(screen.getByLabelText('Confirm password'), confirmPassword)
}

describe('CreateUserDialog', () => {
  beforeEach(() => {
    postMock.mockReset()
  })

  it('opens a dialog with name, email, password and confirm password fields', async () => {
    await openDialog()

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    // The confirmation is always shown in plain text.
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'text')
  })

  it('reveals the password only while the eye button is hovered', async () => {
    const user = await openDialog()
    const password = screen.getByLabelText('Password')
    const eye = screen.getByRole('button', { name: 'Show password' })
    expect(password).toHaveAttribute('type', 'password')

    await user.hover(eye)
    expect(password).toHaveAttribute('type', 'text')
    expect(eye).toHaveAttribute('aria-pressed', 'true')

    await user.unhover(eye)
    expect(password).toHaveAttribute('type', 'password')
    expect(eye).toHaveAttribute('aria-pressed', 'false')
  })

  it('reveals the password while the eye button has keyboard focus', async () => {
    const user = await openDialog()
    const password = screen.getByLabelText('Password')
    await user.click(password)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus()
    expect(password).toHaveAttribute('type', 'text')

    await user.tab()
    expect(password).toHaveAttribute('type', 'password')
  })

  it('rejects a confirmation that does not match the password', async () => {
    const user = await openDialog()
    await fillForm(user, {
      name: 'Grace Agent',
      email: 'grace@example.com',
      password: 'password123',
      confirmPassword: 'password124',
    })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('aria-invalid', 'true')
    expect(postMock).not.toHaveBeenCalled()
  })

  it('reports a mismatch even while other fields are invalid', async () => {
    const user = await openDialog()
    await fillForm(user, { name: 'Al', email: '', password: 'password123', confirmPassword: 'other' })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('re-checks the confirmation when the password is changed afterwards', async () => {
    const user = await openDialog()
    await fillForm(user, { name: 'Grace Agent', email: 'grace@example.com', password: 'password123' })

    await user.type(screen.getByLabelText('Password'), '4')

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('shows validation errors and does not submit invalid input', async () => {
    const user = await openDialog()
    await fillForm(user, { name: 'Al', email: 'not-an-email', password: 'short' })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('requires every field', async () => {
    const user = await openDialog()

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('Name must be at least 3 characters.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText('Confirm the password.')).toBeInTheDocument()
    expect(postMock).not.toHaveBeenCalled()
  })

  it('posts the trimmed values and closes the dialog on success', async () => {
    postMock.mockResolvedValue({ data: created } as AxiosResponse<UserListItem>)
    const user = await openDialog()
    await fillForm(user, { name: '  Grace Agent ', email: 'grace@example.com', password: 'password123' })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postMock).toHaveBeenCalledExactlyOnceWith('/api/users', {
      displayName: 'Grace Agent',
      email: 'grace@example.com',
      password: 'password123',
    })
  })

  it('starts from a blank form when reopened', async () => {
    const user = await openDialog()
    await fillForm(user, { name: 'Grace', email: '', password: '' })

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Add user' }))

    expect(await screen.findByLabelText('Name')).toHaveValue('')
  })

  it('shows a duplicate email on the email field and keeps the dialog open', async () => {
    postMock.mockRejectedValue(new ApiError(409, 'A user with this email already exists.'))
    const user = await openDialog()
    await fillForm(user, { name: 'Grace Agent', email: 'grace@example.com', password: 'password123' })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    // Only the field error, no form-level alert.
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows other API errors in an alert', async () => {
    postMock.mockRejectedValue(new ApiError(500, 'Something broke.'))
    const user = await openDialog()
    await fillForm(user, { name: 'Grace Agent', email: 'grace@example.com', password: 'password123' })

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something broke.')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
