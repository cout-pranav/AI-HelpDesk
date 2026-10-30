import { MessagesSquare } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '../auth/authContext'
import { LoginForm } from '../auth/LoginForm'

function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-heading text-lg font-semibold tracking-tight', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
        <MessagesSquare className="size-4" />
      </span>
      Support desk
    </div>
  )
}

export function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <p className="p-6 text-center text-muted-foreground">Checking session…</p>
  }
  // Covers both a successful login (login() sets `user`) and visiting /login while signed in.
  if (user) {
    return <Navigate to="/" replace />
  }

  // On large screens a pine panel carries the brand beside the form; on small ones the brand
  // sits above the form.
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Brand />
        <p className="max-w-md font-heading text-4xl leading-tight font-semibold tracking-tight">
          Every customer email, answered or routed.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-10 p-6 md:p-10">
        <Brand className="text-primary lg:hidden [&>span]:bg-primary [&>span]:text-primary-foreground" />
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
