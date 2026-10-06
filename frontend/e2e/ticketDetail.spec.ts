import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, apiUrl, loginAsAdmin, seedToken } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'
import { apiCreateUser } from './helpers/users.ts'

async function createTicket(request: APIRequestContext) {
  const subject = uniqueId('detail')
  const email = `sender-${uniqueId('s')}@e2e.test`
  const name = 'Detail Sender'
  const text = 'First line of the email.\nSecond line of the email.'
  const attachments = [{ fileName: 'invoice.pdf' }, { fileName: 'screenshot.png' }]
  const response = await postInboundEmail(request, {
    subject,
    from: { email, name },
    text,
    attachments,
  })
  expect(response.status()).toBe(201)
  const { ticketId } = (await response.json()) as { ticketId: number }
  return { id: ticketId, subject, email, name }
}

test.describe('ticket detail', () => {
  test('opens from the list, shows the real ticket and goes back', async ({ page, request }) => {
    const ticket = await createTicket(request)
    await loginAsAdmin(page, request)

    await page.goto('/tickets')
    await page.getByRole('searchbox', { name: 'Search' }).fill(ticket.subject)
    const table = page.getByRole('table', { name: 'Tickets' })
    await table.getByRole('link', { name: ticket.subject }).click()

    await expect(page).toHaveURL(`/tickets/${ticket.id}`)
    await expect(page.getByRole('heading', { level: 1, name: ticket.subject })).toBeVisible()
    await expect(page.getByText(`#${ticket.id}`, { exact: true })).toBeVisible()
    await expect(page.getByText(`${ticket.name} <${ticket.email}>`)).toBeVisible()

    const messages = page.getByRole('region', { name: 'Messages' })
    await expect(messages.getByText('First line of the email.')).toBeVisible()
    await expect(messages.getByText('Second line of the email.')).toBeVisible()
    const attachments = messages.getByRole('list', { name: 'Attachments' })
    await expect(attachments.getByText('invoice.pdf')).toBeVisible()
    await expect(attachments.getByText('screenshot.png')).toBeVisible()

    await page.getByRole('link', { name: 'Back to tickets' }).click()
    await expect(page).toHaveURL('/tickets')
  })

  test('a direct link and a reload still show the ticket', async ({ page, request }) => {
    const ticket = await createTicket(request)
    await loginAsAdmin(page, request)

    await page.goto(`/tickets/${ticket.id}`)
    const heading = page.getByRole('heading', { level: 1, name: ticket.subject })
    await expect(heading).toBeVisible()

    await page.reload()
    await expect(heading).toBeVisible()
    await expect(page.getByText('First line of the email.')).toBeVisible()
  })

  test('an unknown ticket id shows the backend not-found message', async ({ page, request }) => {
    await loginAsAdmin(page, request)

    await page.goto('/tickets/2147483647')
    await expect(page.getByRole('alert')).toHaveText('Ticket not found.')
  })

  test('the API returns 404 for an unknown id and 401 without a token', async ({ request }) => {
    const { token } = await apiLogin(request)
    const missing = await request.get(`${apiUrl}/api/tickets/2147483647`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(missing.status()).toBe(404)

    const ticket = await createTicket(request)
    const anonymous = await request.get(`${apiUrl}/api/tickets/${ticket.id}`)
    expect(anonymous.status()).toBe(401)
  })

  test('a signed-out visitor is redirected to the login page', async ({ page, request }) => {
    const ticket = await createTicket(request)

    await page.goto(`/tickets/${ticket.id}`)
    await expect(page).toHaveURL(/\/login$/)
  })

  test('an agent can view the detail page', async ({ page, request }) => {
    const ticket = await createTicket(request)
    const agent = await apiCreateUser(request)
    const { token } = await apiLogin(request, agent)
    await seedToken(page, token)

    await page.goto(`/tickets/${ticket.id}`)
    await expect(page.getByRole('heading', { level: 1, name: ticket.subject })).toBeVisible()
  })
})
