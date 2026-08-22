import { clearSessionCookie, getAuthSecret, readSessionJwe } from "@/lib/auth/session";

/**
 * Logout — best-effort revoke then clear the session cookie.
 *
 * Revoking a GitHub App *user* access token cleanly requires the GitHub App
 * private key (JWT) plus the installation id, neither of which the stateless
 * JWE persists (by design). We therefore attempt revocation as best-effort and
 * swallow every failure so logout is never blocked. The `__session` cookie is
 * always cleared and `{ ok: true }` returned.
 *
 * Runtime is `nodejs` per design revision obs #320/#321.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = await readSessionJwe(cookieHeader, getAuthSecret());

  if (session) {
    await bestEffortRevoke(session.token);
  }

  const headers = new Headers({ "content-type": "application/json" });
  headers.append("set-cookie", clearSessionCookie());
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function bestEffortRevoke(token: string): Promise<void> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return;
  try {
    // Best-effort revocation via the OAuth-app token-revoke endpoint. An
    // authenticated GitHub App revoke needs the app private key + installation
    // id, which we don't persist; any failure here is intentionally ignored.
    await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "meperboard",
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch {
    // best-effort — never block logout
  }
}
