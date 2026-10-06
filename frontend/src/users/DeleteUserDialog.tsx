import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'
import type { UserListItem } from './UsersList'

// Soft-deletes an agent after confirmation. Not rendered for admins, who can't be deleted.
export function DeleteUserDialog({ user }: { user: UserListItem }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/api/users/${user.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      // The server unassigns the deleted user's tickets.
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
      handleOpenChange(false)
    },
  })

  // Every open starts without the previous attempt's error.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) deleteUser.reset()
  }

  const error = deleteUser.error
    ? deleteUser.error instanceof ApiError
      ? deleteUser.error.message
      : 'Could not delete user. Please try again.'
    : null

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${user.displayName}`}
          />
        }
      >
        <Trash2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user?</AlertDialogTitle>
          <AlertDialogDescription>
            {user.displayName} ({user.email}) will lose access and be removed from the users list.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteUser.isPending}
            onClick={() => deleteUser.mutate()}
          >
            {deleteUser.isPending && <Loader2 className="animate-spin" />}
            {deleteUser.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
