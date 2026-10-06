import { expect, test, type APIRequestContext } from '@playwright/test'
import { apiLogin, apiUrl, loginAsAdmin, seedToken } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'
import { apiCreateUser } from './helpers/users.ts'

async function createTicket(request: APIRequestContext) {
  const subject = uniqueId('assign')
  const response = await postInboundEmail(request, { subject })
  expect(response.status()).toBe(201)
  const { ticketId } = (await response.json()) as { ticketId: number }
  return { id: ticketId, subject }
}

test.describe('ticket assignment', () => {
  test('an admin assigns a ticket, it persists and shows in the list filter', async ({
    page,
    request,
  }) => {
    const ticket = await createTicket(request)
    const agent = await apiCreateUser(request)
    await loginAsAdmin(page, request)

    await page.goto(`/tickets/${ticket.id}`)
    const picker = page.getByRole('combobox', { name: 'Assignee' })
    await expect(picker).toBeEnabled()

    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/api/tickets/${ticket.id}/assignee`) && r.request().method() === 'PUT',
    )
    await picker.selectOption({ label: agent.displayName })
    expect((await saved).status()).toBe(200)
    await expect(picker).toBeEnabled()

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Assignee' }).locator('option:checked')).toHaveText(
      agent.displayName,
    )

    await page.goto('/tickets')
    await page.getByRole('searchbox', { name: 'Search' }).fill(ticket.subject)
    await page.getByRole('combobox', { name: 'Assignee' }).selectOption({ label: agent.displayName })
    const row = page
      .getByRole('table', { name: 'Tickets' })
      .getByRole('row')
      .filter({ hasText: ticket.subject })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText(agent.displayName)

    await page.goto(`/tickets/${ticket.id}`)
    const picker2 = page.getByRole('combobox', { name: 'Assignee' })
    await expect(picker2).toBeEnabled()
    const unassigned = page.waitForResponse(
      (r) => r.url().endsWith(`/api/tickets/${ticket.id}/assignee`) && r.request().method() === 'PUT',
    )
    await picker2.selectOption({ label: 'Unassigned' })
    expect((await unassigned).status()).toBe(200)

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Assignee' }).locator('option:checked')).toHaveText(
      'Unassigned',
    )
  })

  test('an agent sees the assignee as text and cannot assign through the API', async ({
    page,
    request,
  }) => {
    const ticket = await createTicket(request)
    const agent = await apiCreateUser(request)
    const { token } = await apiLogin(request, agent)
    await seedToken(page, token)

    await page.goto(`/tickets/${ticket.id}`)
    await expect(page.getByRole('heading', { level: 1, name: ticket.subject })).toBeVisible()
    await expect(page.getByText('Unassigned', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Assignee' })).toHaveCount(0)

    const response = await request.put(`${apiUrl}/api/tickets/${ticket.id}/assignee`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId: agent.id },
    })
    expect(response.status()).toBe(403)
  })
})
