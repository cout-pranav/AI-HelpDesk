import { expect, test, type Page } from '@playwright/test'
import { loginAsAdmin, readToken } from './helpers/auth.ts'
import { e2eAdmin } from './testUsers.ts'

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

function welcome(page: Page) {
  return page.getByRole('heading', { name: `Welcome, ${e2eAdmin.displayName}` })
}

test.describe('login form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('admin signs in and lands on the home page', async ({ page }) => {
    await submitLogin(page, e2eAdmin.email, e2eAdmin.password)

    await expect(page).toHaveURL('/')
    await expect(welcome(page)).toBeVisible()
    await expect(page.getByText(`${e2eAdmin.displayName} (Admin)`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    expect(await readToken(page)).toBeTruthy()
  })

  test('shows an error for a wrong password and stays signed out', async ({ page }) => {
    await submitLogin(page, e2eAdmin.email, 'Wrong-Passw0rd!')

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    expect(await readToken(page)).toBeNull()
  })

  test('password is case-sensitive', async ({ page }) => {
    await submitLogin(page, e2eAdmin.email, e2eAdmin.password.toUpperCase())

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
  })

  test('shows the same error for an unknown email', async ({ page }) => {
    await submitLogin(page, `nobody-${Date.now()}@e2e.test`, 'Whatever-Passw0rd!')

    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('email is case-insensitive and surrounding whitespace is trimmed', async ({ page }) => {
    await submitLogin(page, `  ${e2eAdmin.email.toUpperCase()}  `, e2eAdmin.password)

    await expect(page).toHaveURL('/')
    await expect(welcome(page)).toBeVisible()
  })

  test('empty submit shows required errors and sends no request', async ({ page }) => {
    let loginRequests = 0
    await page.route('**/api/auth/login', (route) => {
      loginRequests++
      return route.continue()
    })

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Email is required.')).toBeVisible()
    await expect(page.getByText('Password is required.')).toBeVisible()
    expect(loginRequests).toBe(0)
  })

  test('malformed email shows a validation error and sends no request', async ({ page }) => {
    let loginRequests = 0
    await page.route('**/api/auth/login', (route) => {
      loginRequests++
      return route.continue()
    })

    await submitLogin(page, 'not-an-email', 'Some-Passw0rd!')

    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    expect(loginRequests).toBe(0)
  })

  test('validation error clears once the field is corrected', async ({ page }) => {
    await page.getByLabel('Email').fill('bad')
    await page.getByLabel('Password').click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()

    await page.getByLabel('Email').fill(e2eAdmin.email)

    await expect(page.getByText('Enter a valid email address.')).toBeHidden()
  })

  test('rejects an over-long email and password without sending a request', async ({ page }) => {
    let loginRequests = 0
    await page.route('**/api/auth/login', (route) => {
      loginRequests++
      return route.continue()
    })

    await submitLogin(page, `${'a'.repeat(250)}@e2e.test`, 'p'.repeat(129))

    await expect(page.getByText('Email must be at most 256 characters.')).toBeVisible()
    await expect(page.getByText('Password must be at most 128 characters.')).toBeVisible()
    expect(loginRequests).toBe(0)
  })

  test('submit button is disabled and shows progress while signing in', async ({ page }) => {
    await page.route('**/api/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800))
      await route.continue()
    })

    await submitLogin(page, e2eAdmin.email, e2eAdmin.password)

    await expect(page.getByRole('button', { name: 'Signing in…' })).toBeDisabled()
    await expect(page).toHaveURL('/')
  })

  test('shows a generic error when the server fails', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => route.fulfill({ status: 500, body: '' }))

    await submitLogin(page, e2eAdmin.email, e2eAdmin.password)

    await expect(page.getByText('Could not sign in. Please try again.')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })
})

test.describe('login page when already signed in', () => {
  test('visiting /login redirects to the home page', async ({ page, request }) => {
    await loginAsAdmin(page, request)

    await page.goto('/login')

    await expect(page).toHaveURL('/')
    await expect(welcome(page)).toBeVisible()
  })
})
