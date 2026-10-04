import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState, type ReactElement, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import type { UserListItem } from './UsersList'

export type UserFormMode = 'create' | 'edit'

// Limits match the POST/PUT /api/users checks and the Users column lengths.
const passwordLength = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')

function userFields(mode: UserFormMode) {
  return z.object({
    displayName: z
      .string()
      .trim()
      .min(3, 'Name must be at least 3 characters.')
      .max(100, 'Name must be at most 100 characters.'),
    email: z
      .string()
      .trim()
      .min(1, 'Email is required.')
      .max(256, 'Email must be at most 256 characters.')
      .pipe(z.email('Enter a valid email address.')),
    // On edit a blank password means "keep the current one".
    password: mode === 'create' ? passwordLength : z.union([z.literal(''), passwordLength]),
    confirmPassword: mode === 'create' ? z.string().min(1, 'Confirm the password.') : z.string(),
  })
}

function userSchema(mode: UserFormMode) {
  const fields = userFields(mode)
  return fields.refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
    // Run the match check even while other fields (e.g. name) are invalid.
    when: (payload) => fields.pick({ confirmPassword: true }).safeParse(payload.value).success,
  })
}

const createSchema = userSchema('create')
const editSchema = userSchema('edit')

export type UserFormValues = z.infer<typeof createSchema>

const blankValues: UserFormValues = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

type UserFormDialogProps = {
  mode: UserFormMode
  // The user being edited; its name and email pre-fill the form.
  user?: UserListItem
  trigger: ReactElement
  triggerContent: ReactNode
  title: string
  description: string
  submitLabel: string
  pendingLabel: string
  mutationFn: (values: UserFormValues) => Promise<UserListItem>
  // Queries to refresh after a successful save.
  invalidateKeys: QueryKey[]
}

export function UserFormDialog({
  mode,
  user,
  trigger,
  triggerContent,
  title,
  description,
  submitLabel,
  pendingLabel,
  mutationFn,
  invalidateKeys,
}: UserFormDialogProps) {
  const [open, setOpen] = useState(false)
  // Shown only while the eye button is hovered (or keyboard-focused).
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const idPrefix = mode === 'create' ? 'create-user' : `edit-user-${user?.id}`

  const initialValues = (): UserFormValues =>
    user ? { ...blankValues, displayName: user.displayName, email: user.email } : blankValues

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(mode === 'create' ? createSchema : editSchema),
    mode: 'onTouched',
    defaultValues: initialValues(),
  })

  const saveUser = useMutation({
    mutationFn,
    onSuccess: () => {
      for (const queryKey of invalidateKeys) void queryClient.invalidateQueries({ queryKey })
      handleOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: 'A user with this email already exists.' })
      }
    },
  })

  // Every open starts from the user's current data (or a blank form), however the last one closed.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      reset(initialValues())
    } else {
      setShowPassword(false)
      saveUser.reset()
    }
  }

  const onSubmit = handleSubmit((values) => saveUser.mutate(values))

  // 409 is shown on the email field instead.
  const error =
    saveUser.error && !(saveUser.error instanceof ApiError && saveUser.error.status === 409)
      ? saveUser.error instanceof ApiError
        ? saveUser.error.message
        : 'Could not save user. Please try again.'
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger}>{triggerContent}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={errors.displayName ? true : undefined}>
              <FieldLabel htmlFor={`${idPrefix}-name`}>Name</FieldLabel>
              <Input
                id={`${idPrefix}-name`}
                autoComplete="off"
                aria-invalid={errors.displayName ? true : undefined}
                {...register('displayName')}
              />
              <FieldError errors={[errors.displayName]} />
            </Field>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
              <Input
                id={`${idPrefix}-email`}
                type="email"
                placeholder="agent@example.com"
                autoComplete="off"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor={`${idPrefix}-password`}>Password</FieldLabel>
              <div className="relative">
                <Input
                  id={`${idPrefix}-password`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-9"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={mode === 'edit' ? `${idPrefix}-password-hint` : undefined}
                  // Re-check the confirmation when the password changes after it was entered.
                  {...register('password', { deps: 'confirmPassword' })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
                  aria-label="Show password"
                  aria-pressed={showPassword}
                  aria-controls={`${idPrefix}-password`}
                  onPointerEnter={() => setShowPassword(true)}
                  onPointerLeave={() => setShowPassword(false)}
                  onFocus={() => setShowPassword(true)}
                  onBlur={() => setShowPassword(false)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              {mode === 'edit' && (
                <FieldDescription id={`${idPrefix}-password-hint`}>
                  Leave blank to keep the current password.
                </FieldDescription>
              )}
              <FieldError errors={[errors.password]} />
            </Field>
            <Field data-invalid={errors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor={`${idPrefix}-confirm-password`}>Confirm password</FieldLabel>
              <Input
                id={`${idPrefix}-confirm-password`}
                // Deliberately always visible so the admin can check what they typed.
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={errors.confirmPassword ? true : undefined}
                {...register('confirmPassword')}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
            <DialogFooter className="mt-2">
              <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={saveUser.isPending}>
                {saveUser.isPending && <Loader2 className="animate-spin" />}
                {saveUser.isPending ? pendingLabel : submitLabel}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
