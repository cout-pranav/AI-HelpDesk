import type { APIRequestContext } from '@playwright/test'
import { apiLogin, apiUrl } from './auth.ts'

export type NewUser = { displayName: string; email: string; password: string }

/** Returns details for a user that is unique to this call, so tests never collide. */
export function uniqueUser(prefix = 'agent'): NewUser {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    displayName: `${prefix} ${suffix}`,
    email: `${prefix}-${suffix}@e2e.test`,
    password: 'E2e-Agent-Passw0rd!',
  }
}

/** Creates an Agent through the API as the seeded admin and returns its id. */
export async function apiCreateUser(request: APIRequestContext, user: NewUser = uniqueUser()) {
  const { token } = await apiLogin(request)
  const response = await request.post(`${apiUrl}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: user,
  })
  if (!response.ok()) {
    throw new Error(`API create user failed: ${response.status()} ${await response.text()}`)
  }
  const created = (await response.json()) as { id: number }
  return { ...user, id: created.id }
}
