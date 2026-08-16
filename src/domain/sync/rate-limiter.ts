/**
 * GitHub rate-limit handling for the read-only sync connector.
 *
 * The connector observes `X-RateLimit-Remaining` on every response and backs
 * off with exponential retry on 403/429. When quota is exhausted or the retry
 * budget is spent, the limiter flips to a "paused" state that the sync service
 * surfaces to the user as "sync paused" — it never fails loudly.
 */

/** Minimal header reader so tests can inject a plain map instead of a `Headers`. */
export interface HeadersLike {
  get(name: string): string | null;
}

/** Snapshot of a GitHub rate-limit window. */
export interface RateLimitInfo {
  remaining: number | null;
  /** Epoch seconds at which the window resets. */
  resetAt: number | null;
}

/** Whether an HTTP status indicates the request was rate-limited. */
export function isRateLimitedStatus(status: number): boolean {
  return status === 403 || status === 429;
}

/** Parse the GitHub rate-limit headers into a snapshot. */
export function parseRateLimit(headers: HeadersLike): RateLimitInfo {
  return {
    remaining: parseHeaderInt(headers.get("x-ratelimit-remaining")),
    resetAt: parseHeaderInt(headers.get("x-ratelimit-reset")),
  };
}

/** Parse a `Retry-After` header (seconds). Returns `null` when absent. */
export function parseRetryAfter(headers: HeadersLike): number | null {
  return parseHeaderInt(headers.get("retry-after"));
}

/**
 * Exponential backoff delay in milliseconds.
 *
 * Honors a `Retry-After` value when present; otherwise grows as
 * 1s, 2s, 4s, 8s, … capped at 60s.
 */
export function backoffDelayMs(attempt: number, retryAfterSeconds: number | null): number {
  const BASE_MS = 1000;
  const MAX_MS = 60_000;

  if (retryAfterSeconds != null && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, MAX_MS);
  }
  return Math.min(BASE_MS * 2 ** Math.max(attempt, 0), MAX_MS);
}

/** Whether there is remaining quota (or no quota info at all). */
export function hasRemainingQuota(info: RateLimitInfo): boolean {
  return info.remaining == null || info.remaining > 0;
}

export type RetryOutcome = "retry" | "paused";

export interface RateLimiterOptions {
  /** Retry attempts allowed before pausing. Defaults to 3. */
  maxRetries?: number;
  /** Injected sleep for tests; defaults to a real `setTimeout` promise. */
  sleep?: (ms: number) => Promise<void>;
}

/** Stateful rate limiter driving the connector's retry loop. */
export class RateLimiter {
  paused = false;
  remaining: number | null = null;
  resetAt: number | null = null;

  constructor(private readonly options: RateLimiterOptions = {}) {}

  get maxRetries(): number {
    return this.options.maxRetries ?? 3;
  }

  /** Record the latest rate-limit snapshot from a response's headers. */
  observe(headers: HeadersLike): RateLimitInfo {
    const info = parseRateLimit(headers);
    this.remaining = info.remaining;
    this.resetAt = info.resetAt;
    return info;
  }

  /**
   * Handle a rate-limited response: pause when quota is exhausted or the retry
   * budget is spent, otherwise back off and signal a retry.
   */
  async handleRateLimited(headers: HeadersLike, attempt: number): Promise<RetryOutcome> {
    const info = this.observe(headers);

    if (!hasRemainingQuota(info)) {
      this.paused = true;
      return "paused";
    }
    if (attempt >= this.maxRetries) {
      this.paused = true;
      return "paused";
    }

    const retryAfter = parseRetryAfter(headers);
    await (this.options.sleep ?? defaultSleep)(backoffDelayMs(attempt, retryAfter));
    return "retry";
  }
}

function parseHeaderInt(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
