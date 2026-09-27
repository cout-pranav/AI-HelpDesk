import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '../lib/api'
import { useAuth } from './authContext'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
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
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => login.mutate(values))

  const error = login.error
    ? login.error instanceof ApiError && login.error.status === 401
      ? 'Invalid email or password.'
      : 'Could not sign in. Please try again.'
    : null

  return (
    <form className="login-form" onSubmit={onSubmit} noValidate>
      <h2>Sign in</h2>
      <label>
        Email
        <input
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email && <span className="field-error">{errors.email.message}</span>}
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
        {errors.password && <span className="field-error">{errors.password.message}</span>}
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
