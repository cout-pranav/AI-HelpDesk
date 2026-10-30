import { useQuery } from '@tanstack/react-query'
import { ErrorAlert } from '@/components/ErrorAlert'
import { tablePanel } from '@/components/tablePanel'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
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
import { api, errorMessage } from '@/lib/api'
import type { UserListItem } from '@/types/user'
import { DeleteUserDialog } from './DeleteUserDialog'
import { EditUserDialog } from './EditUserDialog'

export function UsersList() {
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserListItem[]>('/api/users').then((r) => r.data),
  })

  if (users.isPending) {
    return <UsersListSkeleton />
  }

  if (users.isError) {
    return <ErrorAlert>{errorMessage(users.error, 'Could not load users.')}</ErrorAlert>
  }

  if (users.data.length === 0) {
    return <p className="text-muted-foreground">No users found.</p>
  }

  return (
    <div className={tablePanel}>
      <Table>
        <TableCaption className="sr-only">Users</TableCaption>
        <UsersTableHeader />
        <TableBody>
          {users.data.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <span className="flex items-center gap-2.5 font-medium">
                  <UserAvatar name={user.displayName} />
                  {user.displayName}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <EditUserDialog user={user} />
                  {/* Admins can't be deleted (the API refuses too). */}
                  {user.role !== 'Admin' && <DeleteUserDialog user={user} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function UsersTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Created</TableHead>
        <TableHead className="w-0">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  )
}

const SKELETON_ROWS = 5

// Mirrors the real table's columns so the layout doesn't shift when data arrives.
function UsersListSkeleton() {
  return (
    <div className={tablePanel}>
      <Table aria-busy="true">
        <TableCaption className="sr-only">Loading users…</TableCaption>
        <UsersTableHeader />
        <TableBody>
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-48" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-14 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-16 rounded-4xl" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-7 w-15 rounded-md" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
