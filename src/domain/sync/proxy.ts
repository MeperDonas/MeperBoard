import { execSync } from "node:child_process";

/**
 * Read-only GitHub proxy logic.
 *
 * The Next.js route handler under `src/app/api/github/[...path]/route.ts` is a
 * thin shell over these pure functions. Keeping the logic here (rather than in
 * the route file) makes the method allow-list, URL building, token resolution,
 * and rate-limit forwarding directly unit-testable without spinning up `next`.
 *
 * READ-ONLY GUARANTEE: the proxy forwards only GET. The method allow-list plus
 * the route handler exporting no POST/PATCH/PUT/DELETE handlers ensure the
 * client can never trigger a GitHub write.
 */

export const GITHUB_API_BASE = "https://api.github.com";

/** Build an upstream GitHub API URL from the catch-all route segments. */
export function buildGithubApiUrl(path: string[]): string {
  return `${GITHUB_API_BASE}/${path.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

/** The proxy only ever forwards GET requests. */
export function isAllowedMethod(method: string): boolean {
  return method === "GET";
}

/**
 * Resolve the GitHub PAT. Prefers the server-side `GITHUB_TOKEN` env var and
 * falls back to `gh auth token`. Never hardcodes a token; anonymous (null) is
 * allowed but rate-limited.
 */
export function resolveToken(
  env: Record<string, string | undefined>,
  getGhToken: () => string | null,
): string | null {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  return getGhToken();
}

/** Read the token from the `gh` CLI when it is available and authenticated. */
export function getGhAuthToken(): string | null {
  try {
    const token = execSync("gh auth token", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export interface ProxyResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface ProxyDeps {
  path: string[];
  method: string;
  token: string | null;
  fetcher: (url: string, init: RequestInit) => Promise<Response>;
}

/** Headers forwarded from the upstream response to the client. */
const FORWARD_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "retry-after",
] as const;

/**
 * Proxy a single request to the GitHub API, read-only.
 *
 * - Non-GET methods are rejected with 405 before any upstream call.
 * - A bearer token is attached only when one is resolved.
 * - Rate-limit headers are forwarded so the client's rate limiter can act.
 * - A 403/429 upstream response is surfaced as 429 "sync paused".
 */
export async function proxyGithubRequest(deps: ProxyDeps): Promise<ProxyResult> {
  if (!isAllowedMethod(deps.method)) {
    return { status: 405, body: { error: "Method not allowed" }, headers: { allow: "GET" } };
  }

  const url = buildGithubApiUrl(deps.path);
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "MeperBoard",
  };
  if (deps.token) headers.authorization = `Bearer ${deps.token}`;

  const upstream = await deps.fetcher(url, { method: "GET", headers });
  const forwarded = collectHeaders(upstream.headers);

  if (upstream.status === 403 || upstream.status === 429) {
    return {
      status: 429,
      body: { error: "sync paused", rate_limited: true },
      headers: forwarded,
    };
  }

  return { status: upstream.status, body: await readJsonBody(upstream), headers: forwarded };
}

function collectHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of FORWARD_HEADERS) {
    const value = headers.get(name);
    if (value) out[name] = value;
  }
  return out;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
