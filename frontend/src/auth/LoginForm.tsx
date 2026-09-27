import { useState, type FormEvent } from 'react'
import { ApiError } from '../lib/api'
import { useAuth } from './authContext'

export function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    login.mutate({ email, password })
  }

  const error = login.error
    ? login.error instanceof ApiError && login.error.status === 401
      ? 'Invalid email or password.'
      : 'Could not sign in. Please try again.'
    : null

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Sign in</h2>
      <label>
        Email
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && <p className="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
