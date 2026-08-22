import { NextRequest, NextResponse } from "next/server";

/**
 * Content-Security-Policy with a per-request nonce.
 *
 * Next.js injects inline `<script>`s for the RSC payload (`self.__next_f.push`),
 * so a bare `script-src 'self'` breaks the app. The canonical pattern (Next.js
 * guidance) is a middleware that issues a random nonce per request, allows it in
 * `script-src` with `'strict-dynamic'`, and forwards it to SSR via an `x-nonce`
 * request header so `layout.tsx` can stamp the inline theme script.
 *
 * The matcher excludes `/api`, `_next/static`, `_next/image`, and `favicon.ico`.
 * Consequence (accepted): the nonce forces dynamic rendering on every page.
 */

/** Generate a fresh, high-entropy nonce for this request. */
export function generateNonce(): string {
  return crypto.randomUUID();
}

/** Build the full CSP directive set for the given nonce. */
export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://*.githubusercontent.com data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Return a copy of `headers` with the request nonce stamped as `x-nonce`. */
export function applyNonceRequestHeaders(headers: Headers, nonce: string): Headers {
  const next = new Headers(headers);
  next.set("x-nonce", nonce);
  return next;
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);
  const requestHeaders = applyNonceRequestHeaders(request.headers, nonce);

  return NextResponse.next({
    request: { headers: requestHeaders },
    headers: { "content-security-policy": csp },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
