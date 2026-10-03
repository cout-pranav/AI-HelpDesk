import { expect, test } from '@playwright/test'
import { apiLogin, apiUrl } from './helpers/auth.ts'
import { e2eAdmin } from './testUsers.ts'

const loginUrl = `${apiUrl}/api/auth/login`
const meUrl = `${apiUrl}/api/auth/me`

test.describe('GET /api/health', () => {
  test('returns ok', async ({ request }) => {
    const response = await request.get(`${apiUrl}/api/health`)

    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

test.describe('POST /api/auth/login', () => {
  test('returns a token and the user for valid credentials', async ({ request }) => {
    const response = await request.post(loginUrl, {
      data: { email: e2eAdmin.email, password: e2eAdmin.password },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.token).toEqual(expect.any(String))
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(body.user).toMatchObject({
      email: e2eAdmin.email,
      displayName: e2eAdmin.displayName,
      role: 'Admin',
    })
  })

  test('normalizes email case and whitespace', async ({ request }) => {
    const response = await request.post(loginUrl, {
      data: { email: `  ${e2eAdmin.email.toUpperCase()} `, password: e2eAdmin.password },
    })

    expect(response.status()).toBe(200)
  })

  test('returns 401 for a wrong password', async ({ request }) => {
    const response = await request.post(loginUrl, {
      data: { email: e2eAdmin.email, password: 'wrong' },
    })

    expect(response.status()).toBe(401)
    expect((await response.json()).detail).toBe('Invalid email or password.')
  })

  test('returns the same 401 for an unknown email', async ({ request }) => {
    const response = await request.post(loginUrl, {
      data: { email: `nobody-${Date.now()}@e2e.test`, password: 'whatever' },
    })

    expect(response.status()).toBe(401)
    expect((await response.json()).detail).toBe('Invalid email or password.')
  })

  test('returns 401 for an empty email or password', async ({ request }) => {
    const noEmail = await request.post(loginUrl, { data: { email: '', password: 'x' } })
    const noPassword = await request.post(loginUrl, { data: { email: e2eAdmin.email, password: '' } })

    expect(noEmail.status()).toBe(401)
    expect(noPassword.status()).toBe(401)
  })

  test('returns 401 for an over-long email or password', async ({ request }) => {
    const longEmail = await request.post(loginUrl, {
      data: { email: `${'a'.repeat(260)}@e2e.test`, password: 'x' },
    })
    const longPassword = await request.post(loginUrl, {
      data: { email: e2eAdmin.email, password: 'p'.repeat(129) },
    })

    expect(longEmail.status()).toBe(401)
    expect(longPassword.status()).toBe(401)
  })

  test('returns 400 for a body that is not valid JSON', async ({ request }) => {
    const response = await request.post(loginUrl, {
      headers: { 'Content-Type': 'application/json' },
      data: '{not json',
    })

    expect(response.status()).toBe(400)
  })

  test('returns 400 for an empty body', async ({ request }) => {
    const response = await request.post(loginUrl, {
      headers: { 'Content-Type': 'application/json' },
      data: '',
    })

    expect(response.status()).toBe(400)
  })

  test('rejects a body larger than the 4 KB limit', async ({ request }) => {
    const response = await request.post(loginUrl, {
      data: { email: e2eAdmin.email, password: 'x', padding: 'y'.repeat(5000) },
    })

    expect(response.status()).toBe(413)
  })
})

test.describe('GET /api/auth/me', () => {
  test('returns 401 without a token', async ({ request }) => {
    const response = await request.get(meUrl)

    expect(response.status()).toBe(401)
  })

  test('returns 401 with a bad token', async ({ request }) => {
    const response = await request.get(meUrl, {
      headers: { Authorization: 'Bearer garbage.token.value' },
    })

    expect(response.status()).toBe(401)
  })

  test('returns the admin profile with a valid token', async ({ request }) => {
    const { token } = await apiLogin(request)

    const response = await request.get(meUrl, { headers: { Authorization: `Bearer ${token}` } })

    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({
      email: e2eAdmin.email,
      displayName: e2eAdmin.displayName,
      role: 'Admin',
    })
  })
})
