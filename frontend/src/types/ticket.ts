export type TicketStatus = 'Open' | 'Resolved' | 'Closed'
export type TicketCategory = 'GeneralQuestion' | 'TechnicalQuestion' | 'RefundRequest'

export type TicketAssigneeData = {
  id: number
  displayName: string
  email: string
}

export type TicketListItem = {
  id: number
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  source: string
  submitterEmail: string
  submitterName: string | null
  assignee: TicketAssigneeData | null
  createdAt: string
  updatedAt: string
}

export type TicketListResponse = {
  items: TicketListItem[]
  page: number
  pageSize: number
  totalCount: number
}

export type TicketMessage = {
  id: number
  // inbound: from the customer; outbound: an agent's reply.
  direction: 'inbound' | 'outbound'
  senderEmail: string
  senderName: string | null
  body: string
  attachmentNames: string[]
  createdAt: string
  // Whether a reply was emailed to the customer; null for customer messages and replies that aren't emailed.
  deliveryStatus: MessageDeliveryStatus | null
}

export type MessageDeliveryStatus = 'pending' | 'sent' | 'failed'

export type TicketDetailData = {
  id: number
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  source: string
  submitterEmail: string
  submitterName: string | null
  createdAt: string
  updatedAt: string
  assignee: TicketAssigneeData | null
  messages: TicketMessage[]
}

export type DashboardStats = {
  totalTickets: number
  openTickets: number
  resolvedByAi: number
  // null until a ticket has been resolved.
  averageResolutionSeconds: number | null
}

// Tickets created on one day (YYYY-MM-DD, in the viewer's time zone).
export type TicketsPerDay = {
  date: string
  count: number
}
