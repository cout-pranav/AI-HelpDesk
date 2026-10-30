import * as Sentry from '@sentry/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initSentry } from './sentry'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

const initMock = vi.mocked(Sentry.init)

describe('initSentry', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    initMock.mockReset()
  })

  it('does nothing without a DSN', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '')

    initSentry()

    expect(initMock).not.toHaveBeenCalled()
  })

  it('initializes Sentry with the DSN, the Vite mode as environment and no personal data', () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o1.ingest.sentry.io/2')

    initSentry()

    expect(initMock).toHaveBeenCalledExactlyOnceWith({
      dsn: 'https://key@o1.ingest.sentry.io/2',
      environment: 'test',
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpBodies: [],
        genAI: { inputs: false, outputs: false },
      },
    })
  })
})
