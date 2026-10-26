import type { TicketCategory, TicketStatus } from '@/types/ticket'

// Labels and badge styles shared by the ticket list and detail views.
export const categoryLabels: Record<TicketCategory, string> = {
  GeneralQuestion: 'General question',
  TechnicalQuestion: 'Technical question',
  RefundRequest: 'Refund request',
}

export const statusVariants: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  Open: 'default',
  Resolved: 'secondary',
  Closed: 'outline',
}

export const ticketStatuses = Object.keys(statusVariants) as TicketStatus[]
export const ticketCategories = Object.keys(categoryLabels) as TicketCategory[]

// The detail page layout, shared by TicketDetail and its loading skeleton: a wide main column for
// the ticket and its thread, and a fixed-width sidebar for the editable fields (so every dropdown
// gets the same width). The columns stack on small screens.
export const ticketDetailColumns = 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_14rem]'

// An API timestamp (UTC, ISO 8601) in the viewer's locale and time zone.
export function formatDate(value: string) {
  return new Date(value).toLocaleString()
}
