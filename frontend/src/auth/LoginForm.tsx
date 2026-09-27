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
    <form className="mx-auto mt-8 flex max-w-xs flex-col gap-3 text-left" onSubmit={onSubmit} noValidate>
      <h2 className="text-xl font-semibold">Sign in</h2>
      <label className="flex flex-col gap-1">
        Email
        <input
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 aria-invalid:border-red-600 aria-invalid:ring-red-600/30 dark:border-gray-700 dark:bg-gray-900"
          type="email"
          autoComplete="username"
          aria-invalid={errors.email ? true : undefined}
          {...register('email')}
        />
        {errors.email && <span className="text-sm text-red-600">{errors.email.message}</span>}
      </label>
      <label className="flex flex-col gap-1">
        Password
        <input
          className="rounded-md border border-gray-300 px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 aria-invalid:border-red-600 aria-invalid:ring-red-600/30 dark:border-gray-700 dark:bg-gray-900"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          {...register('password')}
        />
        {errors.password && <span className="text-sm text-red-600">{errors.password.message}</span>}
      </label>
      {error && <p className="text-red-600" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={login.isPending}
        className="cursor-pointer rounded-md bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
