import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, ApiError } from '@/lib/api'

export type TicketStatus = 'Open' | 'Resolved' | 'Closed'
export type TicketCategory = 'GeneralQuestion' | 'TechnicalQuestion' | 'RefundRequest'

export type TicketListItem = {
  id: number
  subject: string
  status: TicketStatus
  category: TicketCategory | null
  source: string
  submitterEmail: string
  submitterName: string | null
  createdAt: string
  updatedAt: string
}

export type TicketListResponse = {
  items: TicketListItem[]
  page: number
  pageSize: number
  totalCount: number
}

export const TICKETS_PAGE_SIZE = 25

const categoryLabels: Record<TicketCategory, string> = {
  GeneralQuestion: 'General question',
  TechnicalQuestion: 'Technical question',
  RefundRequest: 'Refund request',
}

const statusVariants: Record<TicketStatus, 'default' | 'secondary' | 'outline'> = {
  Open: 'default',
  Resolved: 'secondary',
  Closed: 'outline',
}

// The API returns tickets newest first.
export function TicketsList() {
  const [page, setPage] = useState(1)
  const tickets = useQuery({
    queryKey: ['tickets', { page, pageSize: TICKETS_PAGE_SIZE }],
    queryFn: () =>
      api
        .get<TicketListResponse>('/api/tickets', { params: { page, pageSize: TICKETS_PAGE_SIZE } })
        .then((r) => r.data),
    // Keep showing the current page while the next one loads.
    placeholderData: keepPreviousData,
  })

  if (tickets.isPending) {
    return <TicketsListSkeleton />
  }

  if (tickets.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          {tickets.error instanceof ApiError ? tickets.error.message : 'Could not load tickets.'}
        </AlertDescription>
      </Alert>
    )
  }

  const { items, totalCount, pageSize } = tickets.data
  if (totalCount === 0) {
    return <p className="text-muted-foreground">No tickets yet.</p>
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const first = (tickets.data.page - 1) * pageSize + 1
  const last = first + items.length - 1

  return (
    <>
      <Table aria-busy={tickets.isPlaceholderData || undefined}>
        <TableCaption className="sr-only">Tickets</TableCaption>
        <TicketsTableHeader />
        <TableBody>
          {items.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="text-muted-foreground">#{ticket.id}</TableCell>
              <TableCell className="max-w-md truncate font-medium" title={ticket.subject}>
                {ticket.subject}
              </TableCell>
              <TableCell>
                <div>{ticket.submitterName ?? ticket.submitterEmail}</div>
                {ticket.submitterName && (
                  <div className="text-xs text-muted-foreground">{ticket.submitterEmail}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[ticket.status]}>{ticket.status}</Badge>
              </TableCell>
              <TableCell className={ticket.category ? undefined : 'text-muted-foreground'}>
                {ticket.category ? categoryLabels[ticket.category] : 'Uncategorized'}
              </TableCell>
              <TableCell className="text-muted-foreground">
                <time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleString()}</time>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-4 text-sm">
        <span className="text-muted-foreground">
          Showing {first}–{last} of {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || tickets.isPlaceholderData}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span>
            Page {tickets.data.page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || tickets.isPlaceholderData}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </nav>
    </>
  )
}

function TicketsTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-0">ID</TableHead>
        <TableHead>Subject</TableHead>
        <TableHead>Submitter</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Category</TableHead>
        <TableHead>Received</TableHead>
      </TableRow>
    </TableHeader>
  )
}

const SKELETON_ROWS = 5

// Mirrors the real table's columns so the layout doesn't shift when data arrives.
function TicketsListSkeleton() {
  return (
    <Table aria-busy="true">
      <TableCaption className="sr-only">Loading tickets…</TableCaption>
      <TicketsTableHeader />
      <TableBody>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <TableRow key={i} className="hover:bg-transparent">
            <TableCell>
              <Skeleton className="h-4 w-8" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-56" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-36" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-14 rounded-4xl" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-28" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
