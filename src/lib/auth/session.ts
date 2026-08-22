import { EncryptJWT, jwtDecrypt } from "jose";

/**
 * Stateless session primitives for the GitHub App web-flow auth.
 *
 * This module is a pure domain boundary: it has ZERO React/Next.js imports and
 * only depends on `jose` plus the web-platform globals `crypto.subtle` and
 * `TextEncoder`. That keeps it unit-testable and portable across the `nodejs`
 * runtime used by the auth routes (Next 16 deprecates `runtime='edge'`; see
 * design revision obs #321).
 *
 * ## Algorithm
 * `dir` / `A256GCM` (direct symmetric encryption). The key is derived
 * deterministically from `AUTH_SECRET` via SHA-256, which always yields the 32
 * bytes `A256GCM` requires. GCM provides AEAD integrity, so a tampered or
 * wrong-key ciphertext fails decryption and `readSessionJwe` returns `null`.
 *
 * ## Lifecycle
 * `iat`/`exp` are epoch seconds. `createSession` sets `exp = iat + 8h` (the
 * GitHub App user access token lifetime). `shouldRefresh` is the 30-minute
 * proactive-refresh window; `jwtDecrypt` enforces `exp` at read time, so an
 * already-expired token yields `null` (re-login path).
 */

export interface SessionPayload {
  token: string;
  refresh_token: string;
  login: string;
  avatar_url: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = "__session";
export const AUTH_STATE_COOKIE = "__auth_state";
export const SESSION_MAX_AGE = 2_592_000; // 30 days — absolute session cap
export const STATE_MAX_AGE = 600; // 10 minutes — CSRF state cookie
export const ACCESS_TOKEN_TTL = 3_600 * 8; // 8 hours — GitHub App user token lifetime
export const REFRESH_WINDOW_SECONDS = 30 * 60; // refresh when < 30 min remain
export const AUTH_SECRET_MIN_LENGTH = 32;

const DEV_FALLBACK_SECRET = "dev-insecure-auth-secret-0123456789abcdef";

/**
 * Derive a deterministic 32-byte AES key from `secret` via SHA-256.
 * This guarantees a valid `A256GCM` key regardless of the secret's length,
 * and works on both `nodejs` and edge runtimes (`crypto.subtle` is a web global).
 */
export async function deriveKey(secret: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

/**
 * Resolve `AUTH_SECRET` from the environment with a hard guard.
 * Production requires >= 32 chars; outside production a missing secret falls
 * back to an explicit insecure dev value with a warning.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) {
    if (secret.length < AUTH_SECRET_MIN_LENGTH) {
      throw new Error(
        `AUTH_SECRET must be at least ${AUTH_SECRET_MIN_LENGTH} characters (found ${secret.length}).`,
      );
    }
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required when NODE_ENV=production.");
  }
  console.warn(
    "[auth] AUTH_SECRET is not set; using an insecure development fallback. Set AUTH_SECRET (>= 32 chars) before production.",
  );
  return DEV_FALLBACK_SECRET;
}

/** Build the encrypted JWE payload for a session. */
export function createSession(
  input: Omit<SessionPayload, "iat" | "exp">,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionPayload {
  return { ...input, iat: nowSeconds, exp: nowSeconds + ACCESS_TOKEN_TTL };
}

/** Encrypt a session payload to a compact JWE (dir / A256GCM). */
export async function buildSessionJwe(payload: SessionPayload, secret: string): Promise<string> {
  return encryptClaims(payload, secret);
}

/**
 * Decrypt and validate a `__session` cookie value.
 * Returns the typed payload, or `null` when the cookie is absent, tampered,
 * signed with a different secret, or already expired (`jwtDecrypt` enforces exp).
 */
export async function readSessionJwe(
  cookieHeader: string,
  secret: string,
): Promise<SessionPayload | null> {
  const jwe = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!jwe) return null;
  const claims = await decryptClaims(jwe, secret);
  if (!claims || !isSessionPayload(claims)) return null;
  return claims;
}

/** True when the access token is inside the 30-minute proactive refresh window (or already past). */
export function shouldRefresh(
  exp: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  return exp - nowSeconds < REFRESH_WINDOW_SECONDS;
}

/** Serialize a `__session` Set-Cookie header. */
export function buildSessionCookie(jwe: string, maxAge: number = SESSION_MAX_AGE): string {
  return `${SESSION_COOKIE}=${jwe}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/** Serialize a clearing `__session` Set-Cookie header (value empty, Max-Age 0). */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Build a single-use, encrypted `__auth_state` CSRF cookie (dir / A256GCM). */
export async function buildAuthStateCookie(state: string, secret: string): Promise<string> {
  const jwe = await encryptClaims({ state }, secret);
  return `${AUTH_STATE_COOKIE}=${jwe}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${STATE_MAX_AGE}`;
}

/** Decrypt and return the CSRF state value, or `null` (absent / tampered / expired). */
export async function readAuthState(cookieHeader: string, secret: string): Promise<string | null> {
  const jwe = parseCookie(cookieHeader, AUTH_STATE_COOKIE);
  if (!jwe) return null;
  const claims = await decryptClaims(jwe, secret);
  if (!claims || typeof claims.state !== "string") return null;
  return claims.state;
}

async function encryptClaims(claims: object, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  return await new EncryptJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key);
}

async function decryptClaims(jwe: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const key = await deriveKey(secret);
    const { payload } = await jwtDecrypt(jwe, key, {
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });
    return payload as Record<string, unknown>;
  } catch {
    // Covers JWTExpired (exp past), decrypt failure (wrong key), and tampered input.
    return null;
  }
}

function isSessionPayload(value: object): value is SessionPayload {
  const v = value as Record<string, unknown>;
  return (
    typeof v.token === "string" &&
    typeof v.refresh_token === "string" &&
    typeof v.login === "string" &&
    typeof v.avatar_url === "string" &&
    typeof v.iat === "number" &&
    typeof v.exp === "number"
  );
}

function parseCookie(header: string | undefined | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}
