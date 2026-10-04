import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { useState } from 'react'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { api, ApiError } from '@/lib/api'
import type { UserListItem } from './UsersList'

// Limits match the POST /api/users checks and the Users column lengths.
const createUserFields = z.object({
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
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password must be at most 128 characters.'),
  confirmPassword: z.string().min(1, 'Confirm the password.'),
})

const createUserSchema = createUserFields.refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
  // Run the match check even while other fields (e.g. name) are invalid.
  when: (payload) =>
    createUserFields.pick({ confirmPassword: true }).safeParse(payload.value).success,
})

type CreateUserValues = z.infer<typeof createUserSchema>

const defaultValues: CreateUserValues = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  // Shown only while the eye button is hovered (or keyboard-focused).
  const [showPassword, setShowPassword] = useState(false)
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    mode: 'onTouched',
    defaultValues,
  })

  const createUser = useMutation({
    // confirmPassword is a client-side check only; the API doesn't take it.
    mutationFn: ({ displayName, email, password }: CreateUserValues) =>
      api.post<UserListItem>('/api/users', { displayName, email, password }).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      handleOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: 'A user with this email already exists.' })
      }
    },
  })

  // Every close (cancel, X, Escape, success) starts the next open from a blank form.
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setShowPassword(false)
      reset(defaultValues)
      createUser.reset()
    }
  }

  const onSubmit = handleSubmit((values) => createUser.mutate(values))

  // 409 is shown on the email field instead.
  const error =
    createUser.error && !(createUser.error instanceof ApiError && createUser.error.status === 409)
      ? createUser.error instanceof ApiError
        ? createUser.error.message
        : 'Could not create user. Please try again.'
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlus />
        Add user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create an agent account. They sign in with this email and password.</DialogDescription>
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
              <FieldLabel htmlFor="create-user-name">Name</FieldLabel>
              <Input
                id="create-user-name"
                autoComplete="off"
                aria-invalid={errors.displayName ? true : undefined}
                {...register('displayName')}
              />
              <FieldError errors={[errors.displayName]} />
            </Field>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="create-user-email">Email</FieldLabel>
              <Input
                id="create-user-email"
                type="email"
                placeholder="agent@example.com"
                autoComplete="off"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="create-user-password">Password</FieldLabel>
              <div className="relative">
                <Input
                  id="create-user-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pr-9"
                  aria-invalid={errors.password ? true : undefined}
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
                  aria-controls="create-user-password"
                  onPointerEnter={() => setShowPassword(true)}
                  onPointerLeave={() => setShowPassword(false)}
                  onFocus={() => setShowPassword(true)}
                  onBlur={() => setShowPassword(false)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
              <FieldError errors={[errors.password]} />
            </Field>
            <Field data-invalid={errors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor="create-user-confirm-password">Confirm password</FieldLabel>
              <Input
                id="create-user-confirm-password"
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
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="animate-spin" />}
                {createUser.isPending ? 'Creating…' : 'Create user'}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
