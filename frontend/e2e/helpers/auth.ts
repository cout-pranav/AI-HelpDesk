/// <reference lib="dom" />
import type { APIRequestContext, Page } from '@playwright/test'
import { e2eAdmin } from '../testUsers.ts'

export const apiUrl = 'http://localhost:5281'
export const TOKEN_KEY = 'auth.token'

export type LoginResult = {
  token: string
  user: { id: number; email: string; displayName: string; role: string }
}

/** Logs in through the API and returns the token and user. */
export async function apiLogin(
  request: APIRequestContext,
  credentials: { email: string; password: string } = e2eAdmin,
): Promise<LoginResult> {
  const response = await request.post(`${apiUrl}/api/auth/login`, {
    data: { email: credentials.email, password: credentials.password },
  })
  if (!response.ok()) {
    throw new Error(`API login failed: ${response.status()} ${await response.text()}`)
  }
  return (await response.json()) as LoginResult
}

/** Seeds localStorage with a token before any page script runs. */
export async function seedToken(page: Page, token: string) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  )
}

/**
 * Like seedToken, but only for the first document of the browser tab (tracked in
 * sessionStorage). Use it when a test signs out and later navigates again, so the
 * init script does not put the token back.
 */
export async function seedTokenOnce(page: Page, token: string) {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.sessionStorage.getItem('e2e.seeded')) {
        window.sessionStorage.setItem('e2e.seeded', '1')
        window.localStorage.setItem(key, value)
      }
    },
    [TOKEN_KEY, token],
  )
}

/** Starts the page already signed in as the seeded admin. Returns the token. */
export async function loginAsAdmin(page: Page, request: APIRequestContext) {
  const { token } = await apiLogin(request)
  await seedToken(page, token)
  return token
}

export function readToken(page: Page) {
  return page.evaluate((key) => window.localStorage.getItem(key), TOKEN_KEY)
}
