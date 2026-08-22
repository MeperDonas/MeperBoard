import {
  AUTH_STATE_COOKIE,
  buildSessionCookie,
  buildSessionJwe,
  getAuthSecret,
  readAuthState,
} from "@/lib/auth/session";
import {
  buildRedirectUri,
  buildSessionPayload,
  exchangeCodeForToken,
  fetchGithubUser,
} from "@/lib/auth/oauth";

/**
 * GitHub App web-flow callback.
 *
 * Validates the CSRF `state` against the single-use `__auth_state` cookie
 * (400 on mismatch/missing, before any session is created), exchanges the
 * `code` for a user access token server-side, fetches the public profile,
 * encrypts a stateless JWE session, sets `__session` and redirects to `/`.
 *
 * Any upstream failure (token exchange or profile fetch) redirects home with a
 * short `?auth_error=` code and never sets a session cookie. Runtime is `nodejs`
 * per design revision obs #320/#321.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const secret = getAuthSecret();
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieState = await readAuthState(cookieHeader, secret);

  // CSRF gate: reject any state that doesn't match the cookie we issued.
  if (!state || !cookieState || state !== cookieState) {
    return new Response(JSON.stringify({ error: "invalid_state" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!code) {
    return new Response(JSON.stringify({ error: "missing_code" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "auth_unconfigured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const token = await exchangeCodeForToken({
    code,
    clientId,
    clientSecret,
    redirectUri: buildRedirectUri(request),
  });
  if (!token) {
    return redirectHome(request, "?auth_error=token_exchange_failed");
  }

  const user = await fetchGithubUser(token.access_token);
  if (!user) {
    return redirectHome(request, "?auth_error=user_fetch_failed");
  }

  const payload = buildSessionPayload(
    {
      token: token.access_token,
      refresh_token: token.refresh_token,
      login: user.login,
      avatar_url: user.avatar_url,
    },
    token.expires_in,
  );
  const jwe = await buildSessionJwe(payload, secret);
  const sessionCookie = buildSessionCookie(jwe);

  const headers = new Headers({ location: new URL("/", request.url).toString() });
  headers.append("set-cookie", sessionCookie);
  headers.append("set-cookie", clearAuthStateCookie());
  return new Response(null, { status: 302, headers });
}

function redirectHome(request: Request, query: string): Response {
  return new Response(null, { status: 302, headers: { location: new URL(`/${query}`, request.url).toString() } });
}

function clearAuthStateCookie(): string {
  return `${AUTH_STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
