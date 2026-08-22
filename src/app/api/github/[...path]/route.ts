import {
  isAllowedOrigin,
  isAllowedPath,
  proxyGithubRequest,
  resolveToken,
} from "../../../../domain/sync/proxy";

/**
 * Read-only GitHub proxy — GET only.
 *
 * This route forwards GET requests to `https://api.github.com/{...path}` with
 * the server-side PAT attached. Only `GET` is exported, so Next.js returns 405
 * for POST/PATCH/PUT/DELETE — the client can never trigger a GitHub write.
 *
 * The relay is hardened (Slice 1): the request Origin/Referer must be one of
 * the app's own origins (403 otherwise), and the path must be on the sync
 * allowlist (`repos/{owner}/{repo}/{issues|pulls}` + variants), otherwise 404.
 * The token comes from `GITHUB_TOKEN` and never reaches the browser.
 */
export const runtime = "edge";

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const query = new URL(request.url).search.slice(1);

  const origin = request.headers.get("origin") ?? undefined;
  const referer = request.headers.get("referer") ?? undefined;
  if (!isAllowedOrigin(origin, referer, getAllowedOrigin())) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  if (!isAllowedPath(path)) {
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const token = resolveToken(process.env);

  const result = await proxyGithubRequest({
    path,
    query: query || undefined,
    method: request.method,
    token,
    fetcher: (url, init) => fetch(url, init),
  });

  const headers = new Headers({ "content-type": "application/json" });
  for (const [key, value] of Object.entries(result.headers)) {
    if (value) headers.set(key, value);
  }

  return new Response(JSON.stringify(result.body), { status: result.status, headers });
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
