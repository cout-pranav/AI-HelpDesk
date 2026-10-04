import { CreateUserDialog } from '@/users/CreateUserDialog'
import { UsersList } from '@/users/UsersList'

export function UsersPage() {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Users</h1>
        <CreateUserDialog />
      </div>
      <UsersList />
    </>
  )
}
