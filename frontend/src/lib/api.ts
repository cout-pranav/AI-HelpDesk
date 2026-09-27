import axios from 'axios'

let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

// Wired up by AuthProvider so every request carries the current token
// and a 401 from any protected call signs the user out.
export function configureApiAuth(options: {
  getToken: () => string | null
  onUnauthorized: () => void
}) {
  getToken = options.getToken
  onUnauthorized = options.onUnauthorized
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL })

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// Turn HTTP error responses into ApiError (message from the ProblemDetails body).
// Network errors have no response and are rethrown as-is.
api.interceptors.response.use(undefined, (error: unknown) => {
  if (!axios.isAxiosError(error) || !error.response) {
    return Promise.reject(error)
  }
  const { status, data, statusText } = error.response
  if (status === 401 && getToken()) {
    onUnauthorized()
  }
  const problem = data as { detail?: string; title?: string } | undefined
  const message = problem?.detail ?? problem?.title ?? (statusText || error.message)
  return Promise.reject(new ApiError(status, message))
})
