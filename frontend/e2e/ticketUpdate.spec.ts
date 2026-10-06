import { expect, test } from '@playwright/test'
import { apiLogin, seedToken } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'
import { apiCreateUser } from './helpers/users.ts'

test.describe('ticket status and category', () => {
  test('an agent changes status and category and both persist', async ({ page, request }) => {
    const subject = uniqueId('update')
    const created = await postInboundEmail(request, { subject })
    expect(created.status()).toBe(201)
    const { ticketId } = (await created.json()) as { ticketId: number }

    const agent = await apiCreateUser(request)
    const { token } = await apiLogin(request, agent)
    await seedToken(page, token)

    await page.goto(`/tickets/${ticketId}`)
    const status = page.getByRole('combobox', { name: 'Status' })
    const category = page.getByRole('combobox', { name: 'Category' })
    await expect(status.locator('option:checked')).toHaveText('Open')
    await expect(category.locator('option:checked')).toHaveText('Uncategorized')

    const isPut = (suffix: string) => (r: import('@playwright/test').Response) =>
      r.url().endsWith(`/api/tickets/${ticketId}/${suffix}`) && r.request().method() === 'PUT'

    const statusSaved = page.waitForResponse(isPut('status'))
    await status.selectOption({ label: 'Resolved' })
    expect((await statusSaved).status()).toBe(200)
    await expect(category).toBeEnabled()

    const categorySaved = page.waitForResponse(isPut('category'))
    await category.selectOption({ label: 'Technical question' })
    expect((await categorySaved).status()).toBe(200)

    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Status' }).locator('option:checked')).toHaveText(
      'Resolved',
    )
    await expect(page.getByRole('combobox', { name: 'Category' }).locator('option:checked')).toHaveText(
      'Technical question',
    )

    await page.goto('/tickets')
    await page.getByRole('searchbox', { name: 'Search' }).fill(subject)
    await page.getByRole('combobox', { name: 'Status' }).selectOption({ label: 'Resolved' })
    const row = page
      .getByRole('table', { name: 'Tickets' })
      .getByRole('row')
      .filter({ hasText: subject })
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Resolved')
    await expect(row).toContainText('Technical question')
  })
})
