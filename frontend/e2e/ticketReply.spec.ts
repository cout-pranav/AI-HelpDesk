import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, apiUrl, seedToken } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'
import { apiCreateUser } from './helpers/users.ts'

type Message = {
  direction: string
  body: string
  senderName: string | null
  senderEmail: string
}
type Detail = { id: number; status: string; updatedAt: string; messages: Message[] }

async function createTicket(request: APIRequestContext) {
  const response = await postInboundEmail(request, {
    subject: uniqueId('reply'),
    text: 'Customer question.',
  })
  expect(response.status()).toBe(201)
  const { ticketId } = (await response.json()) as { ticketId: number }
  return ticketId
}

async function createAgent(request: APIRequestContext) {
  const agent = await apiCreateUser(request)
  const { token } = await apiLogin(request, agent)
  return { agent, token, headers: { Authorization: `Bearer ${token}` } }
}

async function getDetail(request: APIRequestContext, id: number, headers: Record<string, string>) {
  const response = await request.get(`${apiUrl}/api/tickets/${id}`, { headers })
  expect(response.status()).toBe(200)
  return (await response.json()) as Detail
}

test.describe('ticket replies (UI)', () => {
  test('an agent sends a reply that persists after a reload', async ({ page, request }) => {
    const ticketId = await createTicket(request)
    const { agent, token, headers } = await createAgent(request)
    await seedToken(page, token)

    await page.goto(`/tickets/${ticketId}`)
    await page.getByRole('textbox', { name: 'Reply' }).fill('  Hello there.\nSecond line.  \n')
    await page.getByRole('button', { name: 'Send reply' }).click()

    const reply = page
      .getByRole('region', { name: 'Messages' })
      .getByRole('listitem', { name: `Reply from ${agent.displayName}` })
    await expect(reply).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Reply' })).toHaveValue('')

    await page.reload()
    const items = page.getByRole('region', { name: 'Messages' }).getByRole('listitem')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toHaveAccessibleName(/^Message from /)
    await expect(items.nth(1)).toHaveAccessibleName(`Reply from ${agent.displayName}`)
    await expect(items.nth(1).getByText('Reply', { exact: true })).toBeVisible()
    await expect(items.nth(1)).toContainText('Hello there.')
    await expect(items.nth(1)).toContainText('Second line.')
    await expect(page.getByRole('combobox', { name: 'Status' }).locator('option:checked')).toHaveText(
      'Open',
    )

    // The stored body is trimmed and keeps its line break.
    const detail = await getDetail(request, ticketId, headers)
    expect(detail.messages[1].body).toBe('Hello there.\nSecond line.')
  })
})

test.describe('ticket replies (API)', () => {
  test('a reply returns 201 with the detail, trimmed, from the signed-in user', async ({
    request,
  }) => {
    const ticketId = await createTicket(request)
    const { agent, headers } = await createAgent(request)

    const response = await request.post(`${apiUrl}/api/tickets/${ticketId}/replies`, {
      headers,
      data: { body: '  Hi\nthere  ' },
    })
    expect(response.status()).toBe(201)
    const detail = (await response.json()) as Detail
    expect(detail.messages).toHaveLength(2)
    expect(detail.messages[0].direction).toBe('inbound')
    const last = detail.messages[1]
    expect(last.direction).toBe('outbound')
    expect(last.body).toBe('Hi\nthere')
    expect(last.senderName).toBe(agent.displayName)
    expect(last.senderEmail).toBe(agent.email)
    expect(detail.status).toBe('Open')
  })

  test('a reply bumps updatedAt', async ({ request }) => {
    const ticketId = await createTicket(request)
    const { headers } = await createAgent(request)
    const before = await getDetail(request, ticketId, headers)

    const response = await request.post(`${apiUrl}/api/tickets/${ticketId}/replies`, {
      headers,
      data: { body: 'Bump' },
    })
    expect(response.status()).toBe(201)

    const after = await getDetail(request, ticketId, headers)
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt))
  })

  test('empty, whitespace-only and over-long bodies are rejected; 10,000 chars is accepted', async ({
    request,
  }) => {
    const ticketId = await createTicket(request)
    const { headers } = await createAgent(request)
    const url = `${apiUrl}/api/tickets/${ticketId}/replies`

    for (const body of ['', '   \n  ', 'a'.repeat(10001)]) {
      const response = await request.post(url, { headers, data: { body } })
      expect(response.status()).toBe(400)
      const problem = (await response.json()) as { errors: Record<string, string[]> }
      expect(problem.errors.body?.length).toBeGreaterThan(0)
    }

    const ok = await request.post(url, { headers, data: { body: 'a'.repeat(10000) } })
    expect(ok.status()).toBe(201)

    const detail = await getDetail(request, ticketId, headers)
    expect(detail.messages).toHaveLength(2)
  })

  test('an unknown ticket gives 404 and a missing token gives 401', async ({ request }) => {
    const { headers } = await createAgent(request)
    const missing = await request.post(`${apiUrl}/api/tickets/2147483647/replies`, {
      headers,
      data: { body: 'Hello' },
    })
    expect(missing.status()).toBe(404)

    const ticketId = await createTicket(request)
    const anonymous = await request.post(`${apiUrl}/api/tickets/${ticketId}/replies`, {
      data: { body: 'Hello' },
    })
    expect(anonymous.status()).toBe(401)
  })
})
