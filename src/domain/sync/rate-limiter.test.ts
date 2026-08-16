import { describe, expect, it } from "vitest";

import {
  RateLimiter,
  backoffDelayMs,
  isRateLimitedStatus,
  parseRateLimit,
  type HeadersLike,
} from "./rate-limiter";

function headers(init: Record<string, string> = {}): HeadersLike {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(init)) {
    map.set(key.toLowerCase(), value);
  }
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
}

describe("isRateLimitedStatus", () => {
  it("treats 403 and 429 as rate-limited", () => {
    expect(isRateLimitedStatus(403)).toBe(true);
    expect(isRateLimitedStatus(429)).toBe(true);
  });

  it("does not treat success or server errors as rate-limited", () => {
    expect(isRateLimitedStatus(200)).toBe(false);
    expect(isRateLimitedStatus(404)).toBe(false);
    expect(isRateLimitedStatus(500)).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("honors a Retry-After value over exponential growth", () => {
    expect(backoffDelayMs(0, 5)).toBe(5000);
  });

  it("grows exponentially with each attempt", () => {
    expect(backoffDelayMs(0, null)).toBe(1000);
    expect(backoffDelayMs(1, null)).toBe(2000);
    expect(backoffDelayMs(2, null)).toBe(4000);
  });

  it("caps at the maximum delay", () => {
    expect(backoffDelayMs(100, null)).toBe(60_000);
    expect(backoffDelayMs(0, 9999)).toBe(60_000);
  });
});

describe("parseRateLimit", () => {
  it("parses remaining and reset headers", () => {
    expect(
      parseRateLimit(headers({ "x-ratelimit-remaining": "3", "x-ratelimit-reset": "1755000000" })),
    ).toEqual({ remaining: 3, resetAt: 1755000000 });
  });

  it("returns nulls when headers are missing", () => {
    expect(parseRateLimit(headers({}))).toEqual({ remaining: null, resetAt: null });
  });
});

describe("RateLimiter.handleRateLimited", () => {
  it("pauses when remaining quota is exhausted", async () => {
    const limiter = new RateLimiter({ sleep: () => Promise.resolve() });
    const outcome = await limiter.handleRateLimited(headers({ "x-ratelimit-remaining": "0" }), 0);

    expect(outcome).toBe("paused");
    expect(limiter.paused).toBe(true);
  });

  it("retries when quota remains and the budget allows", async () => {
    const limiter = new RateLimiter({ sleep: () => Promise.resolve() });
    const outcome = await limiter.handleRateLimited(
      headers({ "x-ratelimit-remaining": "5", "retry-after": "1" }),
      0,
    );

    expect(outcome).toBe("retry");
    expect(limiter.paused).toBe(false);
  });

  it("pauses after exhausting the retry budget", async () => {
    const limiter = new RateLimiter({ maxRetries: 2, sleep: () => Promise.resolve() });
    const outcome = await limiter.handleRateLimited(headers({ "x-ratelimit-remaining": "5" }), 2);

    expect(outcome).toBe("paused");
    expect(limiter.paused).toBe(true);
  });
});
