import { expect, test } from '@playwright/test'
import type { APIResponse } from '@playwright/test'
import { apiUrl } from './helpers/auth.ts'
import { postInboundEmail, uniqueId } from './helpers/inboundEmail.ts'

async function expectCreated(response: APIResponse) {
  expect(response.status()).toBe(201)
  const body = await response.json()
  expect(body.duplicate).toBe(false)
  expect(body.ticketId).toEqual(expect.any(Number))
  return body.ticketId as number
}

test.describe('POST /api/inbound-email: secret', () => {
  test('returns 401 without the secret header', async ({ request }) => {
    const response = await postInboundEmail(request, {}, null)

    expect(response.status()).toBe(401)
    expect((await response.json()).detail).toBe('Invalid inbound email secret.')
  })

  test('returns 401 with a wrong secret', async ({ request }) => {
    const response = await postInboundEmail(request, {}, 'not-the-secret')

    expect(response.status()).toBe(401)
    expect((await response.json()).detail).toBe('Invalid inbound email secret.')
  })

  test('does not accept a JWT instead of the secret', async ({ request }) => {
    const response = await request.post(`${apiUrl}/api/inbound-email`, {
      headers: { Authorization: 'Bearer garbage.token.value' },
      data: { from: { email: 'a@e2e.test' } },
    })

    expect(response.status()).toBe(401)
  })
})

test.describe('POST /api/inbound-email: creating tickets', () => {
  test('creates a ticket and returns 201 with a Location header', async ({ request }) => {
    const response = await postInboundEmail(request)

    const ticketId = await expectCreated(response)
    expect(response.headers()['location']).toMatch(new RegExp(`/api/tickets/${ticketId}$`))
  })

  test('accepts attachments, an html-only body and no sender name', async ({ request }) => {
    const response = await postInboundEmail(request, {
      text: undefined,
      html: '<p>Hello <b>there</b></p>',
      from: { email: `noname-${uniqueId('n')}@e2e.test` },
      attachments: [{ fileName: 'report.pdf' }, { fileName: 'screenshot.png' }],
    })

    await expectCreated(response)
  })

  test('accepts an email without attachments, text or html', async ({ request }) => {
    const response = await postInboundEmail(request, { text: undefined, html: undefined })

    await expectCreated(response)
  })

  test('accepts a missing subject', async ({ request }) => {
    const response = await postInboundEmail(request, { subject: undefined })

    await expectCreated(response)
  })

  test('accepts a blank subject', async ({ request }) => {
    const response = await postInboundEmail(request, { subject: '   ' })

    await expectCreated(response)
  })

  test('truncates an over-long subject and name instead of failing', async ({ request }) => {
    const response = await postInboundEmail(request, {
      subject: 's'.repeat(500),
      from: { email: `long-${uniqueId('l')}@e2e.test`, name: 'n'.repeat(300) },
    })

    await expectCreated(response)
  })

  test('accepts an over-long attachment file name', async ({ request }) => {
    const response = await postInboundEmail(request, {
      attachments: [{ fileName: 'f'.repeat(400) }],
    })

    await expectCreated(response)
  })
})

test.describe('POST /api/inbound-email: deduplication', () => {
  test('returns the existing ticket for a repeated messageId', async ({ request }) => {
    const messageId = `<${uniqueId('dup')}@e2e.test>`

    const ticketId = await expectCreated(await postInboundEmail(request, { messageId }))
    const again = await postInboundEmail(request, { messageId })

    expect(again.status()).toBe(200)
    expect(await again.json()).toEqual({ ticketId, duplicate: true })
  })

  test('treats a messageId with surrounding whitespace as the same email', async ({ request }) => {
    const messageId = uniqueId('trim')

    const ticketId = await expectCreated(await postInboundEmail(request, { messageId }))
    const again = await postInboundEmail(request, { messageId: `  ${messageId}  ` })

    expect(again.status()).toBe(200)
    expect(await again.json()).toEqual({ ticketId, duplicate: true })
  })

  test('creates a new ticket for a different messageId', async ({ request }) => {
    const first = await expectCreated(await postInboundEmail(request))
    const second = await expectCreated(await postInboundEmail(request))

    expect(second).not.toBe(first)
  })

  test('does not deduplicate emails without a messageId', async ({ request }) => {
    const first = await expectCreated(await postInboundEmail(request, { messageId: undefined }))
    const second = await expectCreated(await postInboundEmail(request, { messageId: undefined }))

    expect(second).not.toBe(first)
  })

  test('does not deduplicate emails with a blank messageId', async ({ request }) => {
    const first = await expectCreated(await postInboundEmail(request, { messageId: '   ' }))
    const second = await expectCreated(await postInboundEmail(request, { messageId: '   ' }))

    expect(second).not.toBe(first)
  })

  test('does not deduplicate a messageId longer than 500 characters', async ({ request }) => {
    const messageId = `${uniqueId('long')}-${'x'.repeat(500)}`

    const first = await expectCreated(await postInboundEmail(request, { messageId }))
    const second = await expectCreated(await postInboundEmail(request, { messageId }))

    expect(second).not.toBe(first)
  })
})

test.describe('POST /api/inbound-email: sender validation', () => {
  const invalidSenders: Array<[string, unknown]> = [
    ['is missing', undefined],
    ['has no email', {}],
    ['has an empty email', { email: '' }],
    ['has a blank email', { email: '   ' }],
    ['has a malformed email', { email: 'not-an-email' }],
    ['has a display-name email', { email: 'Jane <jane@e2e.test>' }],
    ['has an over-long email', { email: `${'a'.repeat(250)}@e2e.test` }],
  ]

  for (const [name, from] of invalidSenders) {
    test(`returns 400 when the sender ${name}`, async ({ request }) => {
      const response = await postInboundEmail(request, { from })

      expect(response.status()).toBe(400)
      const body = await response.json()
      expect(body.errors['from.email']).toEqual(['A valid sender email address is required.'])
    })
  }

  test('does not create a ticket for an invalid sender, so the messageId stays free', async ({ request }) => {
    const messageId = `<${uniqueId('invalid-first')}@e2e.test>`

    const rejected = await postInboundEmail(request, { messageId, from: { email: 'nope' } })
    const accepted = await postInboundEmail(request, { messageId })

    expect(rejected.status()).toBe(400)
    await expectCreated(accepted)
  })
})
