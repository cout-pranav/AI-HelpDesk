import { Button } from '@/components/ui/button'
import { ErrorAlert } from './ErrorAlert'

// Shown instead of the app when a render error escapes every component (the error is reported to Sentry).
export function AppErrorFallback() {
  return (
    <main className="mx-auto grid max-w-md gap-4 p-8">
      <h1>Something went wrong</h1>
      <ErrorAlert>The page hit an unexpected error. Reloading usually fixes it.</ErrorAlert>
      <Button type="button" className="justify-self-start" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </main>
  )
}
