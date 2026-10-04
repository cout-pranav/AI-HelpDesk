import { expect, test, type Page } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth.ts'
import { apiCreateUser, uniqueUser } from './helpers/users.ts'
import { e2eAdmin } from './testUsers.ts'

function rowFor(page: Page, email: string) {
  return page.getByRole('row').filter({ hasText: email })
}

test.describe('user management (admin)', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request)
  })

  test('admin opens the users page from the nav and sees the seeded admin', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Users' }).click()

    await expect(page).toHaveURL(/\/users$/)
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
    const adminRow = rowFor(page, e2eAdmin.email)
    await expect(adminRow).toBeVisible()
    await expect(adminRow).toContainText(e2eAdmin.displayName)
    await expect(adminRow).toContainText('Admin')
    await expect(adminRow).toContainText('Active')
  })

  test('admin creates an agent who then appears in the list and can sign in', async ({ page }) => {
    const user = uniqueUser()
    await page.goto('/users')

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog', { name: 'Add user' })
    await dialog.getByLabel('Name').fill(user.displayName)
    await dialog.getByLabel('Email').fill(user.email)
    await dialog.getByLabel('Password', { exact: true }).fill(user.password)
    await dialog.getByLabel('Confirm password').fill(user.password)
    await dialog.getByRole('button', { name: 'Create user' }).click()

    await expect(dialog).toBeHidden()
    const row = rowFor(page, user.email)
    await expect(row).toBeVisible()
    await expect(row).toContainText(user.displayName)
    await expect(row).toContainText('Agent')
    await expect(row).toContainText('Active')

    // The new agent can sign in with the given password.
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Password').fill(user.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: `Welcome, ${user.displayName}` })).toBeVisible()
  })

  test('admin edits an agent and the list shows the new details after a reload', async ({
    page,
    request,
  }) => {
    const user = await apiCreateUser(request)
    const updated = uniqueUser('renamed')
    await page.goto('/users')

    await rowFor(page, user.email).getByRole('button', { name: `Edit ${user.displayName}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Edit user' })
    await expect(dialog.getByLabel('Name')).toHaveValue(user.displayName)
    await dialog.getByLabel('Name').fill(updated.displayName)
    await dialog.getByLabel('Email').fill(updated.email)
    await dialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(dialog).toBeHidden()
    await expect(rowFor(page, updated.email)).toContainText(updated.displayName)
    await expect(rowFor(page, user.email)).toHaveCount(0)

    await page.reload()
    await expect(rowFor(page, updated.email)).toContainText(updated.displayName)
    await expect(rowFor(page, user.email)).toHaveCount(0)
  })

  test('admin deletes an agent through the confirm dialog and the row disappears', async ({
    page,
    request,
  }) => {
    const user = await apiCreateUser(request)
    await page.goto('/users')
    await expect(rowFor(page, user.email)).toBeVisible()

    await rowFor(page, user.email).getByRole('button', { name: `Delete ${user.displayName}` }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Delete user?' })
    await expect(dialog).toContainText(user.email)
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click()

    await expect(dialog).toBeHidden()
    await expect(rowFor(page, user.email)).toHaveCount(0)

    await page.reload()
    await expect(rowFor(page, e2eAdmin.email)).toBeVisible()
    await expect(rowFor(page, user.email)).toHaveCount(0)
  })
})
