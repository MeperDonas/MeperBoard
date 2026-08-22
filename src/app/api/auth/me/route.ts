import { getAuthSecret, readSessionJwe } from "@/lib/auth/session";

/**
 * Current user profile.
 *
 * Decrypts `__session` and returns the public profile — `login`, `avatar_url`
 * — plus a best-effort per-user GitHub rate-limit snapshot (`rate_limit`).
 * The GitHub `token`/`refresh_token` are NEVER exposed. Without a valid session
 * this responds 401. Runtime is `nodejs` per obs #320/#321.
 */
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = await readSessionJwe(cookieHeader, getAuthSecret());

  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const rateLimit = await fetchRateLimit(session.token);

  return new Response(
    JSON.stringify({
      login: session.login,
      avatar_url: session.avatar_url,
      rate_limit: rateLimit,
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Per-user GitHub rate-limit snapshot forwarded to the AuthMenu. */
interface RateLimitInfo {
  remaining: number | null;
  resetAt: number | null;
}

/**
 * Probe GitHub's per-user rate limit with the session token (Best-effort).
 *
 * Any failure — network, throttling, or the GitHub App private-key requirement
 * for privileged paths — returns `null` so `/me` never fails because the rate
 * limit could not be read; the AuthMenu then shows its `—` placeholder.
 */
async function fetchRateLimit(token: string): Promise<RateLimitInfo | null> {
  try {
    const res = await fetch("https://api.github.com/rate_limit", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "meperboard",
      },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      resources?: { core?: { remaining?: number; reset?: number } };
    };
    const core = payload.resources?.core;
    if (!core) return null;
    return { remaining: core.remaining ?? null, resetAt: core.reset ?? null };
  } catch {
    return null;
  }
}
