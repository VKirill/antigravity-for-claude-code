# Outbound HTTP: Circuit Breaker + Retry with Backoff

## Scenario

Your Node service calls a third-party API (payment gateway, LLM API, geocoding service). That service:
- Sometimes returns 5xx errors (transient)
- Sometimes goes completely down (sustained)
- Has a rate limit you must respect

You need: retry transient errors with exponential backoff, but stop hammering a down service (circuit breaker), and never hang longer than a budget (AbortSignal.timeout).

---

## Design

```
Request → Circuit Breaker Check → fetch() with AbortSignal.timeout
                                         ↓ success → record success
                                         ↓ transient error → retry with backoff
                                         ↓ sustained failures → open circuit (stop calling)
```

States: `CLOSED` (normal) → `OPEN` (all calls fail fast) → `HALF_OPEN` (probe one call) → back to `CLOSED` or `OPEN`.

---

## Step 1 — Circuit Breaker implementation

```ts
// src/shared/lib/circuit-breaker.ts

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening */
  failureThreshold: number
  /** How long to wait before probing (ms) */
  recoveryTimeout: number
  /** Errors that count as failures (default: all errors) */
  isFailure?: (err: unknown) => boolean
  /** Called when state changes — useful for alerting */
  onStateChange?: (from: CircuitState, to: CircuitState) => void
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED'
  private failures = 0
  private nextProbeAt = 0

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions,
  ) {}

  get currentState(): CircuitState {
    return this.state
  }

  private transition(to: CircuitState): void {
    const from = this.state
    if (from === to) return
    this.state = to
    this.options.onStateChange?.(from, to)
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextProbeAt) {
        throw new CircuitOpenError(this.name)
      }
      // Time to probe
      this.transition('HALF_OPEN')
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      const isFailure = this.options.isFailure?.(err) ?? true
      if (isFailure) this.onFailure()
      throw err
    }
  }

  private onSuccess(): void {
    this.failures = 0
    if (this.state === 'HALF_OPEN') {
      this.transition('CLOSED')
    }
  }

  private onFailure(): void {
    this.failures++
    if (this.state === 'HALF_OPEN' || this.failures >= this.options.failureThreshold) {
      this.nextProbeAt = Date.now() + this.options.recoveryTimeout
      this.failures = 0
      this.transition('OPEN')
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(circuitName: string) {
    super(`Circuit breaker [${circuitName}] is OPEN — request rejected`)
    this.name = 'CircuitOpenError'
  }
}
```

## Step 2 — Retry with exponential backoff

```ts
// src/shared/lib/retry.ts

export interface RetryOptions {
  /** Max number of attempts (including the first) */
  maxAttempts: number
  /** Base delay in ms — doubles each attempt */
  baseDelay: number
  /** Max delay cap in ms */
  maxDelay: number
  /** Add ±20% jitter to avoid thundering herd */
  jitter?: boolean
  /** Which errors should trigger a retry (default: all) */
  retryOn?: (err: unknown, attempt: number) => boolean
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 200,
  maxDelay: 10_000,
  jitter: true,
}

function computeDelay(attempt: number, opts: RetryOptions): number {
  // Exponential: 200ms, 400ms, 800ms, 1600ms...
  const base = Math.min(opts.baseDelay * Math.pow(2, attempt - 1), opts.maxDelay)
  if (!opts.jitter) return base
  // ±20% jitter
  const jitterFactor = 0.8 + Math.random() * 0.4
  return Math.floor(base * jitterFactor)
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      const shouldRetry = opts.retryOn?.(err, attempt) ?? true
      const hasMoreAttempts = attempt < opts.maxAttempts

      if (!shouldRetry || !hasMoreAttempts) break

      const delay = computeDelay(attempt, opts)
      await new Promise<void>((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
```

## Step 3 — HTTP client combining both

```ts
// src/shared/lib/http-client.ts
import { CircuitBreaker } from './circuit-breaker.js'
import { withRetry } from './retry.js'
import { logger } from './logger.js'

export interface HttpClientOptions {
  /** Base URL — e.g. 'https://api.stripe.com/v1' */
  baseUrl: string
  /** Default request timeout in ms (uses AbortSignal.timeout) */
  timeout?: number
  /** Circuit breaker config */
  circuitBreaker?: {
    failureThreshold?: number
    recoveryTimeout?: number
  }
  /** Retry config */
  retry?: {
    maxAttempts?: number
    baseDelay?: number
  }
  /** Default headers merged into every request */
  headers?: Record<string, string>
}

export class HttpClient {
  private readonly circuit: CircuitBreaker
  private readonly timeout: number
  private readonly retryMaxAttempts: number
  private readonly retryBaseDelay: number

  constructor(
    private readonly name: string,
    private readonly options: HttpClientOptions,
  ) {
    this.timeout = options.timeout ?? 30_000
    this.retryMaxAttempts = options.retry?.maxAttempts ?? 3
    this.retryBaseDelay = options.retry?.baseDelay ?? 200

    this.circuit = new CircuitBreaker(name, {
      failureThreshold: options.circuitBreaker?.failureThreshold ?? 5,
      recoveryTimeout: options.circuitBreaker?.recoveryTimeout ?? 60_000,
      isFailure: (err) => {
        // Don't count 4xx as circuit failures — those are caller errors
        if (err instanceof HttpResponseError && err.status < 500) return false
        return true
      },
      onStateChange: (from, to) => {
        logger.warn({ circuit: name, from, to }, 'Circuit breaker state change')
      },
    })
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    return this.circuit.call(() =>
      withRetry(
        () => this.fetchWithTimeout<T>(path, init),
        {
          maxAttempts: this.retryMaxAttempts,
          baseDelay: this.retryBaseDelay,
          // Only retry on transient errors, not 4xx
          retryOn: (err) => {
            if (err instanceof HttpResponseError && err.status < 500) return false
            return true
          },
        },
      )
    )
  }

  private async fetchWithTimeout<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.options.baseUrl}${path}`

    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
        ...init.headers,
      },
      // AbortSignal.timeout() — native in Node 24, no external dep needed
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new HttpResponseError(response.status, response.statusText, body, url)
    }

    return response.json() as Promise<T>
  }
}

export class HttpResponseError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status} ${statusText} from ${url}`)
    this.name = 'HttpResponseError'
  }
}
```

## Step 4 — Wire into a service

```ts
// src/shared/lib/http-clients.ts  (singleton per external service)
import { HttpClient } from './http-client.js'

export const stripeClient = new HttpClient('stripe', {
  baseUrl: 'https://api.stripe.com/v1',
  timeout: 15_000,
  headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  circuitBreaker: { failureThreshold: 5, recoveryTimeout: 30_000 },
  retry: { maxAttempts: 3, baseDelay: 300 },
})

// src/features/payments/payments.service.ts
import { stripeClient } from '../../shared/lib/http-clients.js'

export class PaymentsService {
  async chargeCard(paymentMethodId: string, amount: number): Promise<string> {
    const result = await stripeClient.request<{ id: string }>('/payment_intents', {
      method: 'POST',
      body: JSON.stringify({ payment_method: paymentMethodId, amount, currency: 'usd' }),
    })
    return result.id
  }
}
```

## Test scenarios

```ts
// src/shared/lib/__tests__/circuit-breaker.test.ts
import { describe, it, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker.js'

describe('CircuitBreaker', () => {
  it('opens after failureThreshold consecutive failures', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 3, recoveryTimeout: 1000 })
    const alwaysFail = async () => { throw new Error('fail') }

    for (let i = 0; i < 3; i++) {
      await assert.rejects(() => cb.call(alwaysFail))
    }

    assert.equal(cb.currentState, 'OPEN')
    await assert.rejects(
      () => cb.call(alwaysFail),
      (err: unknown) => err instanceof CircuitOpenError,
    )
  })

  it('transitions HALF_OPEN → CLOSED on success after recovery timeout', async () => {
    const cb = new CircuitBreaker('test', { failureThreshold: 1, recoveryTimeout: 10 })
    await assert.rejects(() => cb.call(async () => { throw new Error('fail') }))
    assert.equal(cb.currentState, 'OPEN')

    await new Promise((r) => setTimeout(r, 15))  // wait for recovery

    let called = false
    await cb.call(async () => { called = true })
    assert.ok(called)
    assert.equal(cb.currentState, 'CLOSED')
  })
})
```

## Combining with AbortSignal.any (user cancellation + timeout)

```ts
async function fetchWithCancellation(url: string, userSignal: AbortSignal): Promise<Response> {
  // Fail fast if: user cancelled OR 10s elapsed — whichever comes first
  const combined = AbortSignal.any([
    userSignal,
    AbortSignal.timeout(10_000),
  ])
  return fetch(url, { signal: combined })
}
```

## Monitoring circuit state

Expose circuit states as a Prometheus metric or health endpoint:

```ts
app.get('/health/circuits', async () => ({
  stripe: stripeClient.circuit.currentState,
  geocoding: geocodingClient.circuit.currentState,
}))
```

Alert when any circuit stays OPEN for > 2 minutes — that's a sustained outage, not a transient blip.
