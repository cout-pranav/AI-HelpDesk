import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { UserFormDialog, type UserFormValues } from './UserFormDialog'
import type { UserListItem } from './UsersList'

export function EditUserDialog({ user }: { user: UserListItem }) {
  // A blank password is left out so the API keeps the current one.
  const updateUser = ({ displayName, email, password }: UserFormValues) =>
    api
      .put<UserListItem>(`/api/users/${user.id}`, { displayName, email, password: password || undefined })
      .then((r) => r.data)

  return (
    <UserFormDialog
      mode="edit"
      user={user}
      trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.displayName}`} />}
      triggerContent={<Pencil />}
      title="Edit user"
      description={`Update ${user.displayName}'s details.`}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      mutationFn={updateUser}
      // The admin may have edited their own account.
      invalidateKeys={[['users'], ['auth', 'me']]}
    />
  )
}
