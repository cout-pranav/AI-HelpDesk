import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  columnFilteringFeature,
  createColumnHelper,
  functionalUpdate,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
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
import {
  categoryLabels,
  statusVariants,
  ticketCategories,
  ticketStatuses,
  type TicketAssigneeData,
  type TicketCategory,
  type TicketStatus,
} from './ticketDisplay'
import { useAssigneeOptions } from './useAssigneeOptions'

export type { TicketCategory, TicketStatus } from './ticketDisplay'


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

export const TICKETS_PAGE_SIZE = 25


// Column ids double as the API's sortBy values.
const columnLabels = {
  id: 'ID',
  subject: 'Subject',
  submitter: 'Submitter',
  status: 'Status',
  category: 'Category',
  assignee: 'Assignee',
  createdAt: 'Received',
} as const

// The category filter value the API uses for tickets that haven't been classified yet.
export const UNCATEGORIZED = 'uncategorized'

// The assignee filter value for tickets nobody is assigned to; other values are user ids.
export const UNASSIGNED = 'unassigned'

// How long typing has to pause before the search is sent.
export const SEARCH_DEBOUNCE_MS = 300

// The API sorts, filters and searches, so no sorted or filtered row models are registered; the
// table only holds the sort, filter and search state.
const features = tableFeatures({ rowSortingFeature, columnFilteringFeature, globalFilteringFeature })
// Filtered columns need a filterFn, or TanStack warns that its 'auto' pick isn't registered.
// It never runs, since the API does the filtering.
const filteredOnServer = () => true
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
        <Link
          to={`/tickets/${info.row.original.id}`}
          className="underline-offset-4 hover:underline focus-visible:underline"
        >
          {info.getValue()}
        </Link>
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
    filterFn: filteredOnServer,
    cell: (info) => <Badge variant={statusVariants[info.getValue()]}>{info.getValue()}</Badge>,
  }),
  helper.accessor('category', {
    header: columnLabels.category,
    filterFn: filteredOnServer,
    cell: (info) => {
      const category = info.getValue()
      return category ? (
        categoryLabels[category]
      ) : (
        <span className="text-muted-foreground">Uncategorized</span>
      )
    },
  }),
  helper.accessor((ticket) => ticket.assignee?.displayName ?? null, {
    id: 'assignee',
    header: columnLabels.assignee,
    filterFn: filteredOnServer,
    cell: (info) =>
      info.getValue() ?? <span className="text-muted-foreground">Unassigned</span>,
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
  // Cleared filters are removed from the state, so these are undefined when not filtering.
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const status = columnFilters.find((f) => f.id === 'status')?.value as string | undefined
  const category = columnFilters.find((f) => f.id === 'category')?.value as string | undefined
  const assignee = columnFilters.find((f) => f.id === 'assignee')?.value as string | undefined
  // The search box updates searchInput on every keystroke; globalFilter is the trimmed term
  // actually sent to the API, set once typing pauses.
  const [searchInput, setSearchInput] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const filters = {
    ...(status && { status }),
    ...(category && { category }),
    ...(assignee && { assignee }),
    ...(globalFilter && { search: globalFilter }),
  }
  const isFiltered = columnFilters.length > 0 || globalFilter !== ''

  // If these fail to load, the filter still offers All and Unassigned.
  const assigneeOptions = useAssigneeOptions()

  const tickets = useQuery({
    queryKey: ['tickets', { page, pageSize: TICKETS_PAGE_SIZE, sortBy, sortDir, ...filters }],
    queryFn: () =>
      api
        .get<TicketListResponse>('/api/tickets', {
          params: { page, pageSize: TICKETS_PAGE_SIZE, sortBy, sortDir, ...filters },
        })
        .then((r) => r.data),
    // Keep showing the current rows while the next page, sort order or filter loads.
    placeholderData: keepPreviousData,
  })

  // A new sort order or filter starts back at the first page.
  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    setSorting((old) => functionalUpdate(updater, old))
    setPage(1)
  }
  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    setColumnFilters((old) => functionalUpdate(updater, old))
    setPage(1)
  }
  const onGlobalFilterChange: OnChangeFn<string> = (updater) => {
    // resetGlobalFilter(true) sets undefined; keep the state a string.
    setGlobalFilter((old) => functionalUpdate(updater, old) ?? '')
    setPage(1)
  }

  const table = useTable({
    features,
    columns,
    data: tickets.data?.items ?? [],
    getRowId: (ticket) => String(ticket.id),
    manualSorting: true,
    manualFiltering: true,
    enableSortingRemoval: false,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
  })

  // Send the search once typing pauses, so each keystroke doesn't fire a request. This sets the
  // state directly because `table` is a new object on every render and would restart the timer.
  useEffect(() => {
    const term = searchInput.trim()
    if (term === globalFilter) return
    const timer = setTimeout(() => {
      setGlobalFilter(term)
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, globalFilter])

  const clearFilters = () => {
    setSearchInput('')
    table.resetGlobalFilter(true)
    table.resetColumnFilters(true)
  }

  const statusColumn = table.getColumn('status')
  const categoryColumn = table.getColumn('category')
  const assigneeColumn = table.getColumn('assignee')
  const toolbar = (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <div className="grid w-full gap-1.5 sm:w-72">
        <Label htmlFor="ticket-search">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="ticket-search"
            type="search"
            className="pl-8"
            placeholder="Subject, submitter or #ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ticket-status-filter">Status</Label>
        <NativeSelect
          id="ticket-status-filter"
          value={status ?? ''}
          // An empty value removes the filter.
          onChange={(e) => statusColumn?.setFilterValue(e.target.value)}
        >
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {ticketStatuses.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ticket-category-filter">Category</Label>
        <NativeSelect
          id="ticket-category-filter"
          value={category ?? ''}
          onChange={(e) => categoryColumn?.setFilterValue(e.target.value)}
        >
          <NativeSelectOption value="">All categories</NativeSelectOption>
          {ticketCategories.map((c) => (
            <NativeSelectOption key={c} value={c}>
              {categoryLabels[c]}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value={UNCATEGORIZED}>Uncategorized</NativeSelectOption>
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="ticket-assignee-filter">Assignee</Label>
        <NativeSelect
          id="ticket-assignee-filter"
          value={assignee ?? ''}
          onChange={(e) => assigneeColumn?.setFilterValue(e.target.value)}
        >
          <NativeSelectOption value="">All assignees</NativeSelectOption>
          <NativeSelectOption value={UNASSIGNED}>Unassigned</NativeSelectOption>
          {assigneeOptions.data?.map((u) => (
            <NativeSelectOption key={u.id} value={String(u.id)}>
              {u.displayName}
              {u.isActive ? '' : ' (inactive)'}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {isFiltered && (
        <Button variant="ghost" onClick={clearFilters}>
          <X />
          Clear filters
        </Button>
      )}
    </div>
  )

  if (tickets.isPending) {
    return (
      <>
        {toolbar}
        <TicketsListSkeleton />
      </>
    )
  }

  if (tickets.isError) {
    return (
      <>
        {toolbar}
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>
            {tickets.error instanceof ApiError ? tickets.error.message : 'Could not load tickets.'}
          </AlertDescription>
        </Alert>
      </>
    )
  }

  const { items, totalCount, pageSize } = tickets.data
  if (totalCount === 0) {
    return (
      <>
        {toolbar}
        <p className="text-muted-foreground">
          {isFiltered ? 'No tickets match these filters.' : 'No tickets yet.'}
        </p>
      </>
    )
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize))
  const first = (tickets.data.page - 1) * pageSize + 1
  const last = first + items.length - 1

  return (
    <>
      {toolbar}
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
              <Skeleton className="h-4 w-24" />
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
