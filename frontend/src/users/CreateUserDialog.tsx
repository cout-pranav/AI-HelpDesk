import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { UserFormDialog, type UserFormValues } from './UserFormDialog'
import type { UserListItem } from './UsersList'

// confirmPassword is a client-side check only; the API doesn't take it.
const createUser = ({ displayName, email, password }: UserFormValues) =>
  api.post<UserListItem>('/api/users', { displayName, email, password }).then((r) => r.data)

export function CreateUserDialog() {
  return (
    <UserFormDialog
      mode="create"
      trigger={<Button />}
      triggerContent={
        <>
          <UserPlus />
          Add user
        </>
      }
      title="Add user"
      description="Create an agent account. They sign in with this email and password."
      submitLabel="Create user"
      pendingLabel="Creating…"
      mutationFn={createUser}
      invalidateKeys={[['users']]}
    />
  )
}
