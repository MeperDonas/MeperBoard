import {
  getGhAuthToken,
  proxyGithubRequest,
  resolveToken,
} from "../../../../domain/sync/proxy";

/**
 * Read-only GitHub proxy — GET only.
 *
 * This route forwards GET requests to `https://api.github.com/{...path}` with
 * the server-side PAT attached. Only `GET` is exported, so Next.js returns 405
 * for POST/PATCH/PUT/DELETE — the client can never trigger a GitHub write. The
 * token comes from `GITHUB_TOKEN` (falling back to `gh auth token`) and never
 * reaches the browser.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const token = resolveToken(process.env, getGhAuthToken);

  const result = await proxyGithubRequest({
    path,
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
