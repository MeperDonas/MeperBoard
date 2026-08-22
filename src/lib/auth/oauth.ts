import { ACCESS_TOKEN_TTL, createSession, type SessionPayload } from "./session";

/**
 * GitHub OAuth + API endpoints used by the web-flow auth routes.
 */
export const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_API_URL = "https://api.github.com";

/** Same-origin callback path that GitHub redirects to. */
export const CALLBACK_PATH = "/api/auth/callback";

/** Shape of the GitHub Apps `access_token` exchange response (mirrors GitHub's error surface). */
export interface GithubTokenResult {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface GithubUser {
  login: string;
  avatar_url: string;
}

/**
 * Derive the OAuth `redirect_uri` for this deployment. It always points at the
 * same-origin `/api/auth/callback` route, matching the URL GitHub eventually
 * redirects back to. Derived from the request so it works in dev and prod.
 */
export function buildRedirectUri(request: Request): string {
  return new URL(CALLBACK_PATH, request.url).toString();
}

/**
 * Server-side, one-time exchange of the `code` for a user access token.
 * Returns the token fields, or `null` on any GitHub failure (non-2xx, an
 * `error`/`error_description` field, or a missing access token).
 */
export async function exchangeCodeForToken(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.code,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  let data: GithubTokenResult;
  try {
    data = (await res.json()) as GithubTokenResult;
  } catch {
    return null;
  }

  if (
    !res.ok ||
    data.error ||
    !data.access_token ||
    !data.refresh_token ||
    typeof data.expires_in !== "number"
  ) {
    return null;
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  };
}

/** Fetch the authenticated user's public profile (login + avatar). */
export async function fetchGithubUser(token: string): Promise<GithubUser | null> {
  const res = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "meperboard",
    },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as Partial<GithubUser>;
  return typeof user.login === "string"
    ? { login: user.login, avatar_url: user.avatar_url ?? "" }
    : null;
}

/**
 * Build a session payload honoring the access token's `expires_in`, falling
 * back to the default `ACCESS_TOKEN_TTL` when the value is missing/invalid.
 */
export function buildSessionPayload(
  fields: { token: string; refresh_token: string; login: string; avatar_url: string },
  expiresIn: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionPayload {
  const payload = createSession(fields, nowSeconds);
  payload.exp = payload.iat + (expiresIn > 0 ? expiresIn : ACCESS_TOKEN_TTL);
  return payload;
}
