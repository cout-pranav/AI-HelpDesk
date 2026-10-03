/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { apiLogin, loginAsAdmin, readToken, seedToken, seedTokenOnce } from './helpers/auth.ts'
import { e2eAdmin } from './testUsers.ts'

const welcomeHeading = { name: `Welcome, ${e2eAdmin.displayName}` }

test.describe('session', () => {
  test('token persists across a reload', async ({ page, request }) => {
    const token = await loginAsAdmin(page, request)
    await page.goto('/')
    await expect(page.getByRole('heading', welcomeHeading)).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', welcomeHeading)).toBeVisible()
    expect(await readToken(page)).toBe(token)
  })

  test('a garbage token redirects to /login and is cleared', async ({ page }) => {
    await seedToken(page, 'not-a-real-token')

    await page.goto('/')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect.poll(() => readToken(page)).toBeNull()
  })

  test('a garbage token on /users redirects to /login', async ({ page }) => {
    await seedToken(page, 'a.b.c')

    await page.goto('/users')

    await expect(page).toHaveURL(/\/login$/)
  })

  test('removing the token from storage signs the user out on the next load', async ({ page, request }) => {
    const { token } = await apiLogin(request)
    await seedTokenOnce(page, token)
    await page.goto('/')
    await expect(page.getByRole('heading', welcomeHeading)).toBeVisible()

    await page.evaluate(() => window.localStorage.removeItem('auth.token'))
    // The session lives in React state until the page reloads.
    await expect(page.getByRole('heading', welcomeHeading)).toBeVisible()
    await page.reload()

    await expect(page).toHaveURL(/\/login$/)
  })

  test('a 401 from the API mid-session signs the user out', async ({ page, request }) => {
    await loginAsAdmin(page, request)
    await page.goto('/users')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    // Home mounts a fresh health query when navigated to client-side; make it return 401.
    await page.route('**/api/health', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }),
    )
    await page.getByRole('link', { name: 'Ticket Management' }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect.poll(() => readToken(page)).toBeNull()
  })

  test('sign out clears the token and returns to /login', async ({ page, request }) => {
    await loginAsAdmin(page, request)
    await page.goto('/')

    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page).toHaveURL(/\/login$/)
    expect(await readToken(page)).toBeNull()
  })

  test('after sign out, visiting protected pages and going back stay on /login', async ({ page, request }) => {
    const { token } = await apiLogin(request)
    await seedTokenOnce(page, token)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/users')
    await expect(page).toHaveURL(/\/login$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('signing in again after sign out shows the home page', async ({ page, request }) => {
    const { token } = await apiLogin(request)
    await seedTokenOnce(page, token)
    await page.goto('/')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(e2eAdmin.email)
    await page.getByLabel('Password').fill(e2eAdmin.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', welcomeHeading)).toBeVisible()
  })
})
