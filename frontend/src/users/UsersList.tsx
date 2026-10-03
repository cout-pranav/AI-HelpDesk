import { useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Role } from '@/auth/authContext'
import { api, ApiError } from '@/lib/api'

export type UserListItem = {
  id: number
  email: string
  displayName: string
  role: Role
  isActive: boolean
  createdAt: string
}

export function UsersList() {
  const users = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserListItem[]>('/api/users').then((r) => r.data),
  })

  if (users.isPending) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading users…
      </p>
    )
  }

  if (users.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>
          {users.error instanceof ApiError ? users.error.message : 'Could not load users.'}
        </AlertDescription>
      </Alert>
    )
  }

  if (users.data.length === 0) {
    return <p className="text-muted-foreground">No users found.</p>
  }

  return (
    <Table>
      <TableCaption className="sr-only">Users</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.data.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.displayName}</TableCell>
            <TableCell>{user.email}</TableCell>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
