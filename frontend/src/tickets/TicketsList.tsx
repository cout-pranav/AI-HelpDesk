import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  createColumnHelper,
  functionalUpdate,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
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

// Column ids double as the API's sortBy values.
const columnLabels = {
  id: 'ID',
  subject: 'Subject',
  submitter: 'Submitter',
  status: 'Status',
  category: 'Category',
  createdAt: 'Received',
} as const

// The API sorts, so no sorted row model is registered; the table only holds the sort state.
const features = tableFeatures({ rowSortingFeature })
const helper = createColumnHelper<typeof features, TicketListItem>()
const columns = helper.columns([
  helper.accessor('id', {
    header: columnLabels.id,
    cell: (info) => <span className="text-muted-foreground">#{info.getValue()}</span>,
  }),
  helper.accessor('subject', {
    header: columnLabels.subject,
    cell: (info) => (
      <div className="max-w-md truncate font-medium" title={info.getValue()}>
        {info.getValue()}
      </div>
    ),
  }),
  helper.accessor((ticket) => ticket.submitterName ?? ticket.submitterEmail, {
    id: 'submitter',
    header: columnLabels.submitter,
    cell: ({ row: { original: ticket } }) => (
      <>
        <div>{ticket.submitterName ?? ticket.submitterEmail}</div>
        {ticket.submitterName && (
          <div className="text-xs text-muted-foreground">{ticket.submitterEmail}</div>
        )}
      </>
    ),
  }),
  helper.accessor('status', {
    header: columnLabels.status,
    cell: (info) => <Badge variant={statusVariants[info.getValue()]}>{info.getValue()}</Badge>,
  }),
  helper.accessor('category', {
    header: columnLabels.category,
    cell: (info) => {
      const category = info.getValue()
      return category ? (
        categoryLabels[category]
      ) : (
        <span className="text-muted-foreground">Uncategorized</span>
      )
    },
  }),
  helper.accessor('createdAt', {
    header: columnLabels.createdAt,
    sortDescFirst: true,
    cell: (info) => (
      <time className="text-muted-foreground" dateTime={info.getValue()}>
        {new Date(info.getValue()).toLocaleString()}
      </time>
    ),
  }),
])

const defaultSorting: SortingState = [{ id: 'createdAt', desc: true }]

export function TicketsList() {
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>(defaultSorting)
  // Sorting removal is disabled, so exactly one column is always sorted.
  const sortBy = sorting[0]?.id ?? 'createdAt'
  const sortDir = sorting[0]?.desc === false ? 'asc' : 'desc'

  const tickets = useQuery({
    queryKey: ['tickets', { page, pageSize: TICKETS_PAGE_SIZE, sortBy, sortDir }],
    queryFn: () =>
      api
        .get<TicketListResponse>('/api/tickets', {
          params: { page, pageSize: TICKETS_PAGE_SIZE, sortBy, sortDir },
        })
        .then((r) => r.data),
    // Keep showing the current rows while the next page or sort order loads.
    placeholderData: keepPreviousData,
  })

  // A new sort order starts back at the first page.
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((old) => functionalUpdate(updater, old))
    setPage(1)
  }

  const table = useTable({
    features,
    columns,
    data: tickets.data?.items ?? [],
    getRowId: (ticket) => String(ticket.id),
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange,
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
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted()
                const SortIcon =
                  sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown
                return (
                  <TableHead
                    key={header.id}
                    className={header.column.id === 'id' ? 'w-0' : undefined}
                    aria-sort={
                      sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined
                    }
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2.5"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <table.FlexRender header={header} />
                      <SortIcon className={sorted ? undefined : 'text-muted-foreground'} />
                    </Button>
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
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

const SKELETON_ROWS = 5

// Mirrors the real table's columns so the layout doesn't shift when data arrives.
function TicketsListSkeleton() {
  return (
    <Table aria-busy="true">
      <TableCaption className="sr-only">Loading tickets…</TableCaption>
      <TableHeader>
        <TableRow>
          {Object.entries(columnLabels).map(([id, label]) => (
            <TableHead key={id} className={id === 'id' ? 'w-0' : undefined}>
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
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
