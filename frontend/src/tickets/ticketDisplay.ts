// Labels and badge styles shared by the ticket list and detail views.
export type TicketStatus = 'Open' | 'Resolved' | 'Closed'
export type TicketCategory = 'GeneralQuestion' | 'TechnicalQuestion' | 'RefundRequest'

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
