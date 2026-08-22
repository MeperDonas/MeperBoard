import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { applyNonceRequestHeaders, buildCsp, generateNonce, proxy } from "./proxy";

describe("CSP nonce middleware", () => {
  it("generates a unique, non-empty nonce", () => {
    const first = generateNonce();
    const second = generateNonce();
    expect(first).toMatch(/^[A-Za-z0-9-]+$/);
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });

  it("builds a directive set with the nonce and strict-dynamic", () => {
    const csp = buildCsp("n-abc", false);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-n-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' https://*.githubusercontent.com data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("adds 'unsafe-eval' only in dev", () => {
    expect(buildCsp("n-abc", true)).toContain("'unsafe-eval'");
    expect(buildCsp("n-abc", false)).not.toContain("'unsafe-eval'");
  });

  it("attaches the nonce to the forwarded request headers", () => {
    const headers = applyNonceRequestHeaders(new Headers({ "x-test": "1" }), "n-xyz");
    expect(headers.get("x-nonce")).toBe("n-xyz");
    expect(headers.get("x-test")).toBe("1");
  });

  it("sets the CSP response header and a matching nonce on the request", () => {
    const request = new NextRequest("http://localhost:3000/");
    const response = proxy(request);

    const csp = response.headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");

    const nonce = csp?.match(/nonce-([A-Za-z0-9-]+)/)?.[1];
    expect(nonce).toBeTruthy();
  });
});
