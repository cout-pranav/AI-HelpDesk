import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, apiUrl, seedToken } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'
import { apiCreateUser } from './helpers/users.ts'

type Ticket = {
  id: number
  subject: string
  status: string
  category: string | null
  submitterEmail: string
  submitterName: string | null
  createdAt: string
}
type TicketList = { items: Ticket[]; page: number; pageSize: number; totalCount: number }

async function createTicket(request: APIRequestContext, subject: string, name = 'E2E Sender') {
  const email = `sender-${uniqueId('s')}@e2e.test`
  const response = await postInboundEmail(request, { subject, from: { email, name } })
  expect(response.status()).toBe(201)
  const { ticketId } = (await response.json()) as { ticketId: number }
  return { id: ticketId, subject, email, name }
}

function getTickets(request: APIRequestContext, token: string, query = '') {
  return request.get(`${apiUrl}/api/tickets${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

async function listTickets(request: APIRequestContext, token: string, query = '') {
  const response = await getTickets(request, token, query)
  expect(response.status()).toBe(200)
  return (await response.json()) as TicketList
}

test.describe('tickets API', () => {
  test('rejects requests without a token', async ({ request }) => {
    const response = await request.get(`${apiUrl}/api/tickets`)
    expect(response.status()).toBe(401)
  })

  test('admin gets a page with the expected shape', async ({ request }) => {
    const ticket = await createTicket(request, uniqueId('shape'))
    const { token } = await apiLogin(request)

    const body = await listTickets(request, token)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(25)
    expect(body.totalCount).toBeGreaterThanOrEqual(1)

    const mine = body.items.find((t) => t.id === ticket.id)
    expect(mine).toMatchObject({
      subject: ticket.subject,
      status: 'Open',
      category: null,
      source: expect.any(String),
      submitterEmail: ticket.email,
      submitterName: ticket.name,
    })
    expect(mine?.createdAt).toMatch(/Z$/)
  })

  test('an agent can list tickets', async ({ request }) => {
    const agent = await apiCreateUser(request)
    const { token } = await apiLogin(request, agent)

    const body = await listTickets(request, token)
    expect(body.items).toBeInstanceOf(Array)
  })

  test('returns the newest ticket first', async ({ request }) => {
    const first = await createTicket(request, uniqueId('order-a'))
    const second = await createTicket(request, uniqueId('order-b'))
    const third = await createTicket(request, uniqueId('order-c'))
    const { token } = await apiLogin(request)

    const body = await listTickets(request, token, '?pageSize=100')
    const ids = body.items.map((t) => t.id)
    expect(ids).toContain(first.id)
    expect(ids.indexOf(third.id)).toBeLessThan(ids.indexOf(second.id))
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id))
    for (const item of body.items) expect(item.createdAt).toMatch(/Z$/)
  })

  test('pages through tickets one at a time', async ({ request }) => {
    await createTicket(request, uniqueId('paging-a'))
    await createTicket(request, uniqueId('paging-b'))
    const { token } = await apiLogin(request)

    const page1 = await listTickets(request, token, '?page=1&pageSize=1')
    const page2 = await listTickets(request, token, '?page=2&pageSize=1')

    expect(page1).toMatchObject({ page: 1, pageSize: 1 })
    expect(page2).toMatchObject({ page: 2, pageSize: 1 })
    expect(page1.items).toHaveLength(1)
    expect(page2.items).toHaveLength(1)
    expect(page1.items[0].id).not.toBe(page2.items[0].id)
    expect(page1.totalCount).toBeGreaterThanOrEqual(2)
    expect(page2.totalCount).toBe(page1.totalCount)
  })

  test('rejects page=0', async ({ request }) => {
    const { token } = await apiLogin(request)
    const response = await getTickets(request, token, '?page=0')
    expect(response.status()).toBe(400)
    const body = (await response.json()) as { errors: Record<string, string[]> }
    expect(body.errors).toHaveProperty('page')
  })

  for (const size of [0, 101]) {
    test(`rejects pageSize=${size}`, async ({ request }) => {
      const { token } = await apiLogin(request)
      const response = await getTickets(request, token, `?pageSize=${size}`)
      expect(response.status()).toBe(400)
      const body = (await response.json()) as { errors: Record<string, string[]> }
      expect(body.errors).toHaveProperty('pageSize')
    })
  }

  test('rejects a non-numeric page', async ({ request }) => {
    const { token } = await apiLogin(request)
    const response = await getTickets(request, token, '?page=abc')
    expect(response.status()).toBe(400)
  })
})

test.describe('tickets page', () => {
  test('admin opens the list from the nav and sees new tickets newest first', async ({
    page,
    request,
  }) => {
    const older = await createTicket(request, uniqueId('older'), 'Olivia Older')
    const newer = await createTicket(request, uniqueId('newer'), 'Nina Newer')
    const { token } = await apiLogin(request)
    await seedToken(page, token)

    await page.goto('/')
    await page.getByRole('link', { name: 'Tickets' }).click()

    await expect(page).toHaveURL(/\/tickets$/)
    await expect(page.getByRole('heading', { name: 'Tickets', level: 1 })).toBeVisible()
    const table = page.getByRole('table', { name: 'Tickets' })
    await expect(table).toBeVisible()

    const newerRow = table.getByRole('row').filter({ hasText: newer.subject })
    await expect(newerRow).toBeVisible()
    await expect(newerRow).toContainText(`#${newer.id}`)
    await expect(newerRow).toContainText(newer.name)
    await expect(newerRow).toContainText(newer.email)
    await expect(newerRow).toContainText('Open')
    await expect(newerRow).toContainText('Uncategorized')
    await expect(newerRow.locator('time')).toHaveAttribute('datetime', /Z$/)

    await expect(table.getByRole('row').filter({ hasText: older.subject })).toBeVisible()
    const rows = await table.getByRole('row').allTextContents()
    const indexOf = (subject: string) => rows.findIndex((text) => text.includes(subject))
    expect(indexOf(newer.subject)).toBeGreaterThan(0)
    expect(indexOf(newer.subject)).toBeLessThan(indexOf(older.subject))
  })

  test('agent can open the tickets page and has no Users link', async ({ page, request }) => {
    const agent = await apiCreateUser(request)
    const ticket = await createTicket(request, uniqueId('agent-view'))
    const { token } = await apiLogin(request, agent)
    await seedToken(page, token)

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Tickets' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Tickets' }).click()

    await expect(page).toHaveURL(/\/tickets$/)
    await expect(page.getByRole('heading', { name: 'Tickets', level: 1 })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: ticket.subject })).toBeVisible()
  })

  test('unauthenticated visit redirects to the login page', async ({ page }) => {
    await page.goto('/tickets')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('pagination moves between pages', async ({ page, request }) => {
    test.setTimeout(120_000)
    const { token } = await apiLogin(request)
    let total = (await listTickets(request, token, '?pageSize=1')).totalCount
    while (total < 26) {
      await createTicket(request, uniqueId('bulk'))
      total++
    }
    total = (await listTickets(request, token, '?pageSize=1')).totalCount
    const pageCount = Math.ceil(total / 25)
    expect(pageCount).toBeGreaterThanOrEqual(2)

    await seedToken(page, token)
    await page.goto('/tickets')

    const pagination = page.getByRole('navigation', { name: 'Pagination' })
    const previous = pagination.getByRole('button', { name: 'Previous' })
    const next = pagination.getByRole('button', { name: 'Next' })

    await expect(pagination).toContainText(`Page 1 of ${pageCount}`)
    await expect(pagination).toContainText(`Showing 1–25 of ${total}`)
    await expect(previous).toBeDisabled()
    await expect(next).toBeEnabled()

    await next.click()
    await expect(pagination).toContainText(`Page 2 of ${pageCount}`)
    await expect(pagination).toContainText(/Showing 26–\d+ of \d+/)
    await expect(previous).toBeEnabled()

    await previous.click()
    await expect(pagination).toContainText(`Page 1 of ${pageCount}`)
    await expect(previous).toBeDisabled()
  })
})
