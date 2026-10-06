// Labels and badge styles shared by the ticket list and detail views.
export type TicketStatus = 'Open' | 'Resolved' | 'Closed'
export type TicketCategory = 'GeneralQuestion' | 'TechnicalQuestion' | 'RefundRequest'

export type TicketAssigneeData = {
  id: number
  displayName: string
  email: string
}

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
