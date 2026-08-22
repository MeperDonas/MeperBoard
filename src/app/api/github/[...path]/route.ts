import { isAllowedOrigin, isAllowedPath, proxyGithubRequest } from "../../../../domain/sync/proxy";
import {
  SESSION_MAX_AGE,
  buildSessionCookie,
  buildSessionJwe,
  clearSessionCookie,
  getAuthSecret,
  readSessionJwe,
  shouldRefresh,
  type SessionPayload,
} from "@/lib/auth/session";
import { buildSessionPayload, refreshAccessToken } from "@/lib/auth/oauth";

/**
 * Read-only GitHub proxy — GET only, per-user.
 *
 * This route forwards GET requests to `https://api.github.com/{...path}` with
 * the AUTHENTICATED user's token. Only `GET` is exported, so Next.js returns 405
 * for POST/PATCH/PUT/DELETE — the client can never trigger a GitHub write.
 *
 * The relay is hardened (Slice 1): the request Origin/Referer must be one of
 * the app's own origins (403 otherwise), and the path must be on the sync
 * allowlist (`repos/{owner}/{repo}/{issues|pulls}` + variants), otherwise 404.
 *
 * ## Per-user token (Slice 3)
 * The proxy no longer uses a shared `GITHUB_TOKEN`. It decrypts the `__session`
 * JWE and injects the user's `token` as the Bearer. Without a valid session:
 * - `AUTH_MODE=pat` (self-host) falls back to the shared `GITHUB_TOKEN` env; the
 *   Origin check is still enforced.
 * - anything else responds 401 — the relay is closed for anonymous callers.
 *
 * Token rotation happens transparently (rate limit gives 5,000 req/hr per user):
 * - **Proactive**: if `exp` is inside the 30-min window, refresh BEFORE the
 *   upstream call and re-emit a re-encrypted `__session` Set-Cookie.
 * - **Reactive**: if the upstream answers 401, refresh ONCE and retry the same
 *   request (max one retry), re-emitting the rotated Set-Cookie.
 * - On a failed refresh (revoked/expired `ghr_`) or a session older than the
 *   30-day absolute cap, the cookie is cleared and 401 forces a re-login.
 *
 * The refresh itself is a server-to-server POST to github.com, so the GET-only
 * proxy contract is preserved (no refresh handler is exported).
 */
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const query = new URL(request.url).search.slice(1);
  const cookieHeader = request.headers.get("cookie") ?? "";

  const origin = request.headers.get("origin") ?? undefined;
  const referer = request.headers.get("referer") ?? undefined;
  if (!isAllowedOrigin(origin, referer, getAllowedOrigin())) {
    return jsonResponse(403, { error: "Forbidden" });
  }
  if (!isAllowedPath(path)) {
    return jsonResponse(404, { error: "Not Found" });
  }

  const secret = getAuthSecret();
  const now = Math.floor(Date.now() / 1000);
  const session = await readSessionJwe(cookieHeader, secret);

  let token: string | null = null;
  let rotatedCookie: string | null = null;
  let refreshed = false;

  if (session) {
    // Absolute session cap: the browser cookie lives 30 days, so a session older
    // than that is force-expired regardless of the (still-expiring) access token.
    if (now - session.iat >= SESSION_MAX_AGE) {
      return jsonResponse(401, { error: "Unauthorized" }, clearSessionCookie());
    }

    if (shouldRefresh(session.exp, now)) {
      const rotated = await refreshAccessToken({
        refreshToken: session.refresh_token,
        clientId: process.env.GITHUB_CLIENT_ID ?? "",
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      });
      if (!rotated) {
        return jsonResponse(401, { error: "Unauthorized" }, clearSessionCookie());
      }
      token = rotated.access_token;
      refreshed = true;
      rotatedCookie = await rotateSessionCookie(session, rotated, secret, now);
    } else {
      token = session.token;
    }
  } else if (process.env.AUTH_MODE === "pat") {
    // Self-host fallback: share a single PAT, but the Origin check still applies.
    // `||` (not `??`) so an empty/missing PAT is treated as "no token" → 401.
    token = process.env.GITHUB_TOKEN || null;
  } else {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  if (token === null) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  const fetcher = (url: string, init: RequestInit) => fetch(url, init);
  let result = await proxyGithubRequest({ path, query: query || undefined, method: request.method, token, fetcher });

  // Reactive refresh: a still-valid-at-read token that GitHub rejects gets ONE
  // refresh + retry. Only when we did not already rotate proactively this request.
  if (result.status === 401 && session && !refreshed) {
    const rotated = await refreshAccessToken({
      refreshToken: session.refresh_token,
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    });
    if (!rotated) {
      return jsonResponse(401, { error: "Unauthorized" }, clearSessionCookie());
    }
    token = rotated.access_token;
    rotatedCookie = await rotateSessionCookie(session, rotated, secret, now);
    result = await proxyGithubRequest({ path, query: query || undefined, method: request.method, token, fetcher });
  }

  const headers = new Headers({ "content-type": "application/json" });
  for (const [key, value] of Object.entries(result.headers)) {
    if (value) headers.set(key, value);
  }
  if (rotatedCookie) headers.set("set-cookie", rotatedCookie);

  return new Response(JSON.stringify(result.body), { status: result.status, headers });
}

function jsonResponse(status: number, body: unknown, setCookie?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (setCookie) headers["set-cookie"] = setCookie;
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Re-encrypt a session around a rotated token pair and serialize its Set-Cookie.
 * Keeps the profile (`login`/`avatar_url`) from the existing session and refreshes
 * `iat`/`exp` from the new `expires_in`, so the cookie now reflects the new tokens.
 */
async function rotateSessionCookie(
  session: SessionPayload,
  rotated: { access_token: string; refresh_token: string; expires_in: number },
  secret: string,
  now: number,
): Promise<string> {
  return buildSessionCookie(
    await buildSessionJwe(
      buildSessionPayload(
        {
          token: rotated.access_token,
          refresh_token: rotated.refresh_token,
          login: session.login,
          avatar_url: session.avatar_url,
        },
        rotated.expires_in,
        now,
      ),
      secret,
    ),
  );
}

/**
 * Build the comma-separated origin allowlist. Production uses `ALLOWED_ORIGIN`
 * (defaulting to the app's origin); development also allows the localhost dev
 * origin so the board still syncs locally.
 */
function getAllowedOrigin(): string {
  const prod = process.env.ALLOWED_ORIGIN || "https://meperboard.vercel.app";
  if (process.env.NODE_ENV !== "production") {
    return `${prod},http://localhost:3000`;
  }
  return prod;
}
