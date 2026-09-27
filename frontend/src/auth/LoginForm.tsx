import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useAuth } from './authContext'

// Login only checks presence and shape; password strength rules belong on the forms that set a password.
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .max(256, 'Email must be at most 256 characters.') // Users.Email column length
    .pipe(z.email('Enter a valid email address.')),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128, 'Password must be at most 128 characters.'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const { login } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    // Validate a field once it loses focus, then re-validate on every change.
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values))

  const error = login.error
    ? login.error instanceof ApiError && login.error.status === 401
      ? 'Invalid email or password.'
      : 'Could not sign in. Please try again.'
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Enter your email and password to access your tickets.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="username"
                aria-invalid={errors.email ? true : undefined}
                {...register('email')}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                {...register('password')}
              />
              <FieldError errors={[errors.password]} />
            </Field>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" />}
              {login.isPending ? 'Signing in…' : 'Sign in'}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
