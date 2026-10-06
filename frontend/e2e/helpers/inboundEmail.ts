import type { APIRequestContext } from '@playwright/test'
import { apiUrl } from './auth.ts'

export const inboundEmailUrl = `${apiUrl}/api/inbound-email`
export const inboundSecretHeader = 'X-Inbound-Email-Secret'
// Test-only value from backend/TicketManagement.Api/appsettings.Testing.json (InboundEmail:Secret).
export const inboundSecret = '35Iho-rbWcypp8mYUY0Qmlu7_zEKMMeVEacH187LToo'

/** A unique value so reruns against a reused database never collide. */
export function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Posts an inbound email. The body is merged over a valid default; pass `secret: null` to omit the header. */
export function postInboundEmail(
  request: APIRequestContext,
  body: Record<string, unknown> = {},
  secret: string | null = inboundSecret,
) {
  return request.post(inboundEmailUrl, {
    headers: secret === null ? {} : { [inboundSecretHeader]: secret },
    data: {
      messageId: `<${uniqueId('msg')}@e2e.test>`,
      from: { email: `sender-${uniqueId('s')}@e2e.test`, name: 'E2E Sender' },
      subject: 'Printer is broken',
      text: 'Please help.',
      ...body,
    },
  })
}
