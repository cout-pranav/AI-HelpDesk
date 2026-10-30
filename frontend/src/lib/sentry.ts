import * as Sentry from '@sentry/react'

// Error reporting. Off unless VITE_SENTRY_DSN is set (in .env.local), so tests and E2E runs never
// report. Uncaught errors and unhandled promise rejections are captured by default; React render
// errors come through the createRoot hooks and the error boundary in main.tsx.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // SDK v11 collects all of these by default. Tickets hold customers' names, emails and messages
    // (sent to Gemini by the Polish/Summarize buttons), so keep request data, cookies, IPs and AI
    // prompts out of Sentry.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpBodies: [],
      genAI: { inputs: false, outputs: false },
    },
  })
}
