import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
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

async function createTicket(
  request: APIRequestContext,
  subject: string,
  name: string | null = 'E2E Sender',
  email = `sender-${uniqueId('s')}@e2e.test`,
) {
  const from = name === null ? { email } : { email, name }
  const response = await postInboundEmail(request, { subject, from })
  expect(response.status()).toBe(201)
  const { ticketId } = (await response.json()) as { ticketId: number }
  return { id: ticketId, subject, email, name }
}

/** Builds a `?a=b&c=d` query string with proper encoding. */
function qs(params: Record<string, string | number>) {
  return `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`
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

test.describe('tickets API sorting, filtering and search', () => {
  test('sorts by subject and breaks ties by id in the same direction', async ({ request }) => {
    const token = uniqueId('sortsub')
    const same1 = await createTicket(request, `${token} same`)
    const same2 = await createTicket(request, `${token} same`)
    const last = await createTicket(request, `${token} zzz`)
    const { token: jwt } = await apiLogin(request)
    const idsFor = async (sortDir: string) =>
      (await listTickets(request, jwt, qs({ search: token, sortBy: 'subject', sortDir }))).items.map(
        (t) => t.id,
      )

    expect(await idsFor('asc')).toEqual([same1.id, same2.id, last.id])
    expect(await idsFor('desc')).toEqual([last.id, same2.id, same1.id])
  })

  test('sorts by submitter name, falling back to the email when there is no name', async ({
    request,
  }) => {
    const token = uniqueId('sortsubm')
    const zed = await createTicket(request, `${token} a`, 'Zed Zebra')
    const noName = await createTicket(request, `${token} b`, null, `mid-${token}@e2e.test`)
    const alice = await createTicket(request, `${token} c`, 'Alice Aardvark')
    const { token: jwt } = await apiLogin(request)

    const asc = await listTickets(
      request,
      jwt,
      qs({ search: token, sortBy: 'submitter', sortDir: 'asc' }),
    )
    expect(asc.items.map((t) => t.id)).toEqual([alice.id, noName.id, zed.id])
    expect(asc.items[1].submitterName).toBeNull()

    const desc = await listTickets(
      request,
      jwt,
      qs({ search: token, sortBy: 'submitter', sortDir: 'DESC' }),
    )
    expect(desc.items.map((t) => t.id)).toEqual([zed.id, noName.id, alice.id])
  })

  test('filters by status and category, case-insensitively and combined with search', async ({
    request,
  }) => {
    const token = uniqueId('filter')
    const ticket = await createTicket(request, `${token} filter me`)
    const { token: jwt } = await apiLogin(request)
    const idsFor = async (params: Record<string, string>) =>
      (await listTickets(request, jwt, qs({ search: token, ...params }))).items.map((t) => t.id)

    expect(await idsFor({ status: 'Open' })).toEqual([ticket.id])
    expect(await idsFor({ status: 'open' })).toEqual([ticket.id])
    expect(await idsFor({ category: 'uncategorized' })).toEqual([ticket.id])
    expect(await idsFor({ status: 'Open', category: 'Uncategorized' })).toEqual([ticket.id])
    expect(await idsFor({ status: 'Resolved' })).toEqual([])
    expect(await idsFor({ status: 'Closed' })).toEqual([])
    expect(await idsFor({ category: 'RefundRequest' })).toEqual([])

    const open = await listTickets(request, jwt, qs({ status: 'Open', pageSize: 100 }))
    expect(open.items.length).toBeGreaterThan(0)
    for (const item of open.items) expect(item.status).toBe('Open')
    const uncategorized = await listTickets(
      request,
      jwt,
      qs({ category: 'uncategorized', pageSize: 100 }),
    )
    for (const item of uncategorized.items) expect(item.category).toBeNull()
    const resolved = await listTickets(request, jwt, qs({ status: 'Resolved', pageSize: 100 }))
    for (const item of resolved.items) expect(item.status).toBe('Resolved')
  })

  test('searches subject, submitter name, email and ticket id', async ({ request }) => {
    const token = uniqueId('search')
    const name = `Quokka${Math.random().toString(36).slice(2, 10)}`
    const target = await createTicket(request, `${token} Network Outage`, name)
    const other = await createTicket(request, `${token} Something Else`)
    const { token: jwt } = await apiLogin(request)
    const search = (term: string) => listTickets(request, jwt, qs({ search: term }))

    const bySubject = await search(`${token.toUpperCase()} network OUTAGE`)
    expect(bySubject.items.map((t) => t.id)).toEqual([target.id])
    expect(bySubject.totalCount).toBe(1)

    const both = await search(token)
    expect(both.totalCount).toBe(2)
    expect(both.items.map((t) => t.id).sort()).toEqual([target.id, other.id].sort())

    expect((await search(name.toLowerCase())).items.map((t) => t.id)).toEqual([target.id])
    expect((await search(target.email)).items.map((t) => t.id)).toEqual([target.id])
    expect((await search(`  #${target.id}  `)).items.map((t) => t.id)).toEqual([target.id])
    expect((await search(String(other.id))).items.map((t) => t.id)).toContain(other.id)
  })

  test('treats % and _ in the search term literally, not as wildcards', async ({ request }) => {
    const token = uniqueId('like')
    const literal = await createTicket(request, `${token} 100%_off`)
    await createTicket(request, `${token} 100XYoff`)
    const { token: jwt } = await apiLogin(request)
    const idsFor = async (term: string) =>
      (await listTickets(request, jwt, qs({ search: term }))).items.map((t) => t.id)

    expect(await idsFor(`${token} 100%_off`)).toEqual([literal.id])
    // These would match both tickets if % or _ were wildcards.
    expect(await idsFor(`${token}%off`)).toEqual([])
    expect(await idsFor(`${token} 1_0`)).toEqual([])
  })

  test('ignores a whitespace-only search', async ({ request }) => {
    const ticket = await createTicket(request, uniqueId('blank'))
    const { token: jwt } = await apiLogin(request)
    const body = await listTickets(request, jwt, qs({ search: '   ', pageSize: 100 }))
    expect(body.items.map((t) => t.id)).toContain(ticket.id)
  })

  test('pages through search results with a stable total', async ({ request }) => {
    const token = uniqueId('searchpage')
    for (const suffix of ['a', 'b', 'c']) await createTicket(request, `${token} ${suffix}`)
    const { token: jwt } = await apiLogin(request)

    const page1 = await listTickets(request, jwt, qs({ search: token, pageSize: 2, page: 1 }))
    const page2 = await listTickets(request, jwt, qs({ search: token, pageSize: 2, page: 2 }))

    expect(page1.items).toHaveLength(2)
    expect(page2.items).toHaveLength(1)
    expect(page1.totalCount).toBe(3)
    expect(page2.totalCount).toBe(3)
    const ids = [...page1.items, ...page2.items].map((t) => t.id)
    expect(new Set(ids).size).toBe(3)
  })

  const invalid: [string, Record<string, string>, string][] = [
    ['sortBy=bogus', { sortBy: 'bogus' }, 'sortBy'],
    ['sortDir=sideways', { sortDir: 'sideways' }, 'sortDir'],
    ['status=Pending', { status: 'Pending' }, 'status'],
    ['category=Billing', { category: 'Billing' }, 'category'],
    ['a 201-character search', { search: 'x'.repeat(201) }, 'search'],
  ]
  for (const [label, params, field] of invalid) {
    test(`rejects ${label}`, async ({ request }) => {
      const { token } = await apiLogin(request)
      const response = await getTickets(request, token, qs(params))
      expect(response.status()).toBe(400)
      const body = (await response.json()) as { errors: Record<string, string[]> }
      expect(body.errors).toHaveProperty(field)
    })
  }

  test('accepts a 200-character search', async ({ request }) => {
    const { token } = await apiLogin(request)
    const body = await listTickets(request, token, qs({ search: 'x'.repeat(200) }))
    expect(body.totalCount).toBe(0)
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
    await expect(newerRow).toContainText('Nina Newer')
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

test.describe('tickets page sorting, search and filters', () => {
  async function openTickets(page: Page, request: APIRequestContext) {
    const { token } = await apiLogin(request)
    await seedToken(page, token)
    await page.goto('/tickets')
    return {
      table: page.getByRole('table', { name: 'Tickets' }),
      search: page.getByRole('searchbox', { name: 'Search' }),
    }
  }

  test('search narrows the list and the Subject header sorts it both ways', async ({
    page,
    request,
  }) => {
    const token = uniqueId('uisort')
    await createTicket(request, `${token} Banana`)
    await createTicket(request, `${token} Cherry`)
    await createTicket(request, `${token} Apple`)
    const { table, search } = await openTickets(page, request)
    const mine = table.getByRole('row').filter({ hasText: token })
    const subjectHeader = table.getByRole('columnheader', { name: 'Subject' })

    await search.fill(token)
    // Default order is newest first.
    await expect(mine).toContainText(['Apple', 'Cherry', 'Banana'])
    await expect(table.getByRole('columnheader', { name: 'Received' })).toHaveAttribute(
      'aria-sort',
      'descending',
    )

    await table.getByRole('button', { name: 'Subject' }).click()
    await expect(subjectHeader).toHaveAttribute('aria-sort', 'ascending')
    await expect(mine).toContainText(['Apple', 'Banana', 'Cherry'])

    await table.getByRole('button', { name: 'Subject' }).click()
    await expect(subjectHeader).toHaveAttribute('aria-sort', 'descending')
    await expect(mine).toContainText(['Cherry', 'Banana', 'Apple'])
  })

  test('a filter with no matches shows the empty state and Clear filters restores the list', async ({
    page,
    request,
  }) => {
    const token = uniqueId('uiclear')
    const ticket = await createTicket(request, `${token} visible`)
    const { table, search } = await openTickets(page, request)
    const status = page.getByRole('combobox', { name: 'Status' })
    const category = page.getByRole('combobox', { name: 'Category' })
    const clear = page.getByRole('button', { name: 'Clear filters' })

    await search.fill(token)
    await expect(table.getByRole('row').filter({ hasText: ticket.subject })).toBeVisible()
    await expect(clear).toBeVisible()

    await status.selectOption('Resolved')
    await expect(page.getByText('No tickets match these filters.')).toBeVisible()

    await clear.click()
    await expect(search).toHaveValue('')
    await expect(status).toHaveValue('')
    await expect(category).toHaveValue('')
    await expect(page.getByText('No tickets match these filters.')).toHaveCount(0)
    await expect(table).toBeVisible()
    await expect(clear).toHaveCount(0)
  })

  test('the Uncategorized filter keeps a new ticket and Refund request drops it', async ({
    page,
    request,
  }) => {
    const token = uniqueId('uicat')
    const ticket = await createTicket(request, `${token} cat`)
    const { table, search } = await openTickets(page, request)
    const category = page.getByRole('combobox', { name: 'Category' })
    const row = table.getByRole('row').filter({ hasText: ticket.subject })

    await search.fill(token)
    await expect(row).toBeVisible()
    await category.selectOption('Uncategorized')
    await expect(row).toBeVisible()
    await category.selectOption('Refund request')
    await expect(page.getByText('No tickets match these filters.')).toBeVisible()
  })

  test('searching #id shows exactly that ticket', async ({ page, request }) => {
    const ticket = await createTicket(request, uniqueId('uiid'))
    await createTicket(request, uniqueId('uiid-other'))
    const { table, search } = await openTickets(page, request)

    await search.fill(`#${ticket.id}`)
    await expect(table.getByRole('row')).toHaveCount(2)
    await expect(table.getByRole('row').filter({ hasText: ticket.subject })).toContainText(
      `#${ticket.id}`,
    )
  })
})
