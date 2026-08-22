import { getAuthSecret, readSessionJwe } from "@/lib/auth/session";

/**
 * Current user profile.
 *
 * Decrypts `__session` and returns only the public profile — `login` and
 * `avatar_url`. The GitHub `token`/`refresh_token` are NEVER exposed. Without a
 * valid session this responds 401. Runtime is `nodejs` per obs #320/#321.
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

  return new Response(JSON.stringify({ login: session.login, avatar_url: session.avatar_url }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
