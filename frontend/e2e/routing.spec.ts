import { expect, test } from '@playwright/test'
import { loginAsAdmin, welcomeHeadingName } from './helpers/auth.ts'
import { e2eAdmin } from './testUsers.ts'

test.describe('unauthenticated access', () => {
  for (const path of ['/', '/users']) {
    test(`${path} redirects to /login`, async ({ page }) => {
      await page.goto(path)

      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    })
  }

  test('an unknown route ends at /login', async ({ page }) => {
    await page.goto('/does/not/exist')

    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('authenticated admin', () => {
  test.beforeEach(async ({ page, request }) => {
    await loginAsAdmin(page, request)
  })

  test('an unknown route redirects to the home page', async ({ page }) => {
    await page.goto('/does/not/exist')

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { name: welcomeHeadingName(e2eAdmin.displayName) })).toBeVisible()
  })

  test('header shows the app link, user info and the Users nav link', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Support desk' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()
    await expect(page.getByText(e2eAdmin.displayName, { exact: true })).toBeVisible()
    await expect(page.getByText('Admin', { exact: true })).toBeVisible()
  })

  test('Users nav link opens the users page and the home link returns', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page).toHaveURL(/\/users$/)
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    await page.getByRole('link', { name: 'Support desk' }).click()
    await expect(page).toHaveURL('/')
  })

  test('visiting /users directly and reloading keeps the admin on the page', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL(/\/users$/)
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  })

  // FIXME: the redesign removed the 'Backend status' text from the app; no UI shows /api/health any more.
  test.fixme('home page shows backend status ok', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Backend status: ok')).toBeVisible()
  })

  test.fixme('home page shows backend status error when the health check fails', async ({ page }) => {
    await page.route('**/api/health', (route) => route.fulfill({ status: 400, body: '' }))

    await page.goto('/')

    await expect(page.getByText('Backend status: error')).toBeVisible()
  })
})
