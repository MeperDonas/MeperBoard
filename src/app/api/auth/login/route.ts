import { buildAuthStateCookie, getAuthSecret } from "@/lib/auth/session";
import { GITHUB_AUTHORIZE_URL, buildRedirectUri } from "@/lib/auth/oauth";

/**
 * GitHub App web-flow entry point.
 *
 * Generates a single-use CSRF `state`, persists it as an encrypted `__auth_state`
 * cookie, then 302s the browser to GitHub's authorize screen carrying
 * `client_id`, `redirect_uri` (same-origin `/api/auth/callback`) and `state`.
 *
 * Runtime is `nodejs` (Next 16 deprecates `runtime='edge'`; see design revision
 * obs #320/#321) so `jose` + `crypto` work without a deprecation warning.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "auth_unconfigured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const state = crypto.randomUUID();
  const secret = getAuthSecret();
  const stateCookie = await buildAuthStateCookie(state, secret);

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", buildRedirectUri(request));
  authorizeUrl.searchParams.set("state", state);

  const headers = new Headers({ location: authorizeUrl.toString() });
  headers.append("set-cookie", stateCookie);
  return new Response(null, { status: 302, headers });
}
