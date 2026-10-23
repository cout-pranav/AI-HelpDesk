import type { TicketDetailData } from '@/tickets/TicketDetail'

// A ticket for components that take the whole ticket; override only what the test is about.
export function makeTicket(overrides: Partial<TicketDetailData> = {}): TicketDetailData {
  return {
    id: 42,
    subject: 'Refund for duplicate charge',
    status: 'Open',
    category: null,
    source: 'email',
    submitterEmail: 'jane@example.com',
    submitterName: 'Jane Student',
    createdAt: '2026-10-05T14:30:00Z',
    updatedAt: '2026-10-05T15:00:00Z',
    assignee: null,
    messages: [],
    ...overrides,
  }
}
