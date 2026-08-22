import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildAuthStateCookie,
  buildSessionJwe,
  createSession,
  readAuthState,
  readSessionJwe,
} from "@/lib/auth/session";

import * as callback from "./callback/route";
import * as login from "./login/route";
import * as logout from "./logout/route";
import * as me from "./me/route";

const SECRET = "0123456789abcdef0123456789abcdef";
const CLIENT_ID = "Iv1.client-auth";
const CLIENT_SECRET = "client-secret-001";

function stubAuthEnv(overrides: Record<string, string | undefined> = {}) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_SECRET", SECRET);
  vi.stubEnv("GITHUB_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("GITHUB_CLIENT_SECRET", CLIENT_SECRET);
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value ?? "");
  }
}

function authRequest(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

/** GitHub `GET /rate_limit` payload shape (the `core` resource is the one forwarded). */
const GITHUB_RATE_LIMIT = {
  resources: { core: { limit: 5000, remaining: 4321, reset: 1725000000 } },
};

/** Stub the global fetch for the auth routes; returns the mock for call inspection. */
function stubFetch(handler?: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn((url: string, init: RequestInit) =>
    Promise.resolve(
      handler
        ? handler(url, init)
        : new Response(JSON.stringify(GITHUB_RATE_LIMIT), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
    ),
  );
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/api/auth/login", () => {
  it("uses the nodejs runtime", () => {
    expect((login as unknown as Record<string, string>).runtime).toBe("nodejs");
  });

  it("redirects to the GitHub authorize URL with state, client_id and redirect_uri, and sets __auth_state", async () => {
    stubAuthEnv();
    const res = await login.GET(authRequest("http://localhost:3000/api/auth/login"));

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("https://github.com");
    expect(location.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback");

    const stateFromUrl = location.searchParams.get("state")!;
    expect(stateFromUrl).toBeTruthy();

    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toContain("__auth_state=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=600");

    // The state the browser sends back must decrypt to exactly what GitHub saw.
    expect(await readAuthState(setCookie, SECRET)).toBe(stateFromUrl);
  });

  it("returns 500 with a config error and no cookie when GITHUB_CLIENT_ID is missing", async () => {
    stubAuthEnv({ GITHUB_CLIENT_ID: undefined });
    const res = await login.GET(authRequest("http://localhost:3000/api/auth/login"));

    expect(res.status).toBe(500);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect((await res.json()).error).toBe("auth_unconfigured");
  });
});

describe("/api/auth/callback", () => {
  async function mockGithubClient() {
    const fetchMock = vi.fn((url: string) => {
      if (url === "https://github.com/login/oauth/access_token") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "ghu_123",
              refresh_token: "ghr_456",
              expires_in: 28800,
              token_type: "bearer",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      if (url === "https://api.github.com/user") {
        return Promise.resolve(
          new Response(
            JSON.stringify({ login: "meperdonas", avatar_url: "https://avatars.example/u.png" }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the nodejs runtime", () => {
    expect((callback as unknown as Record<string, string>).runtime).toBe("nodejs");
  });

  it("exchanges the code, sets __session, clears __auth_state and redirects to /", async () => {
    stubAuthEnv();
    const state = "state-valid-abc";
    const stateCookie = await buildAuthStateCookie(state, SECRET);
    const fetchMock = await mockGithubClient();

    const res = await callback.GET(
      authRequest(`http://localhost:3000/api/auth/callback?code=ghcode&state=${state}`, {
        cookie: stateCookie,
      }),
    );

    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");

    const cookies = setCookies(res);
    const sessionCookie = cookies.find((c) => c.startsWith("__session="));
    const clearedState = cookies.find(
      (c) => c.startsWith("__auth_state=") && c.includes("Max-Age=0"),
    );
    expect(sessionCookie).toBeTruthy();
    expect(clearedState).toBeTruthy();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");

    // Session payload decrypts and carries the profile + exp from the exchange.
    const jwe = sessionCookie!.slice(sessionCookie!.indexOf("=") + 1).split(";")[0];
    const payload = await readSessionJwe(`__session=${jwe}`, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.token).toBe("ghu_123");
    expect(payload!.refresh_token).toBe("ghr_456");
    expect(payload!.login).toBe("meperdonas");
    expect(payload!.avatar_url).toBe("https://avatars.example/u.png");
    expect(payload!.exp - payload!.iat).toBe(28800);

    // The token exchange hit the access_token endpoint with the right params.
    const tokenCall = fetchMock.mock.calls.find(
      ([url]) => url === "https://github.com/login/oauth/access_token",
    ) as [string, RequestInit] | undefined;
    expect(tokenCall).toBeTruthy();
    const body = new URLSearchParams(tokenCall![1].body as string);
    expect(body.get("client_id")).toBe(CLIENT_ID);
    expect(body.get("client_secret")).toBe(CLIENT_SECRET);
    expect(body.get("code")).toBe("ghcode");
    expect(body.get("grant_type")).toBe("authorization_code");

    // The profile fetch used the user's token as a Bearer.
    const userCall = fetchMock.mock.calls.find(
      ([url]) => url === "https://api.github.com/user",
    ) as [string, RequestInit] | undefined;
    expect(userCall).toBeTruthy();
    expect(new Headers(userCall![1].headers as HeadersInit).get("Authorization")).toBe(
      "Bearer ghu_123",
    );
  });

  it("returns 400 and no __session when the state query does not match the cookie", async () => {
    stubAuthEnv();
    const stateCookie = await buildAuthStateCookie("server-state", SECRET);
    const res = await callback.GET(
      authRequest("http://localhost:3000/api/auth/callback?code=ghcode&state=other-state", {
        cookie: stateCookie,
      }),
    );

    expect(res.status).toBe(400);
    expect(setCookies(res).filter((c) => c.startsWith("__session="))).toHaveLength(0);
  });

  it("returns 400 and no __session when there is no state cookie", async () => {
    stubAuthEnv();
    const res = await callback.GET(
      authRequest("http://localhost:3000/api/auth/callback?code=ghcode&state=some-state"),
    );

    expect(res.status).toBe(400);
    expect(setCookies(res).filter((c) => c.startsWith("__session="))).toHaveLength(0);
  });

  it("returns 400 and no __session when the code is missing", async () => {
    stubAuthEnv();
    const state = "state-for-missing-code";
    const stateCookie = await buildAuthStateCookie(state, SECRET);
    const res = await callback.GET(
      authRequest(`http://localhost:3000/api/auth/callback?state=${state}`, { cookie: stateCookie }),
    );

    expect(res.status).toBe(400);
    expect(setCookies(res).filter((c) => c.startsWith("__session="))).toHaveLength(0);
  });

  it("redirects to /?auth_error and sets no __session when the token exchange fails", async () => {
    stubAuthEnv();
    const state = "state-exchange-fail";
    const stateCookie = await buildAuthStateCookie(state, SECRET);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ error: "bad_verification_code", error_description: "The code is invalid." }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );

    const res = await callback.GET(
      authRequest(`http://localhost:3000/api/auth/callback?code=bad&state=${state}`, {
        cookie: stateCookie,
      }),
    );

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/");
    expect(location.searchParams.get("auth_error")).toBe("token_exchange_failed");
    expect(setCookies(res).filter((c) => c.startsWith("__session="))).toHaveLength(0);
  });
});

describe("/api/auth/logout", () => {
  it("uses the nodejs runtime", () => {
    expect((logout as unknown as Record<string, string>).runtime).toBe("nodejs");
  });

  it("is POST-only", () => {
    const handlers = logout as unknown as Record<string, unknown>;
    expect(typeof handlers.POST).toBe("function");
    expect(handlers.GET).toBeUndefined();
  });

  it("clears the __session cookie and returns ok", async () => {
    stubAuthEnv();
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))));

    const jwe = await buildSessionJwe(
      createSession({ token: "ghu_1", refresh_token: "ghr_1", login: "meperdonas", avatar_url: "u" }),
      SECRET,
    );
    const res = await logout.POST(
      authRequest("http://localhost:3000/api/auth/logout", { cookie: `__session=${jwe}` }),
    );

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    const cookies = setCookies(res);
    const cleared = cookies.find((c) => c.startsWith("__session=") && c.includes("Max-Age=0"));
    expect(cleared).toBeTruthy();
  });

  it("still returns ok and clears the cookie when there is no session", async () => {
    stubAuthEnv();
    const res = await logout.POST(authRequest("http://localhost:3000/api/auth/logout"));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(setCookies(res).some((c) => c.startsWith("__session="))).toBe(true);
  });
});

describe("/api/auth/me", () => {
  it("uses the nodejs runtime", () => {
    expect((me as unknown as Record<string, string>).runtime).toBe("nodejs");
  });

  it("returns the public profile with rate_limit without exposing the token when the cookie is valid", async () => {
    stubAuthEnv();
    const fetchMock = stubFetch();
    const jwe = await buildSessionJwe(
      createSession({
        token: "ghu_secret",
        refresh_token: "ghr_secret",
        login: "meperdonas",
        avatar_url: "https://avatars.example/meperdonas.png",
      }),
      SECRET,
    );
    const res = await me.GET(authRequest("http://localhost:3000/api/auth/me", { cookie: `__session=${jwe}` }));

    expect(res.status).toBe(200);
    const parsed = (await res.json()) as Record<string, unknown>;
    expect(parsed.login).toBe("meperdonas");
    expect(parsed.avatar_url).toBe("https://avatars.example/meperdonas.png");
    expect(parsed.token).toBeUndefined();
    expect(parsed.refresh_token).toBeUndefined();
    expect(parsed.rate_limit).toMatchObject({ remaining: 4321, resetAt: 1725000000 });

    // The rate-limit probe used the user's token as a Bearer and hit /rate_limit.
    const rateLimitCall = fetchMock.mock.calls.find(
      ([url]) => url === "https://api.github.com/rate_limit",
    ) as [string, RequestInit] | undefined;
    expect(rateLimitCall).toBeTruthy();
    expect(new Headers(rateLimitCall![1].headers as HeadersInit).get("Authorization")).toBe(
      "Bearer ghu_secret",
    );
  });

  it("returns rate_limit null when the GitHub rate-limit call fails", async () => {
    stubAuthEnv();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("rate limit service down"))));

    const jwe = await buildSessionJwe(
      createSession({
        token: "ghu_secret",
        refresh_token: "ghr_secret",
        login: "meperdonas",
        avatar_url: "https://avatars.example/meperdonas.png",
      }),
      SECRET,
    );
    const res = await me.GET(authRequest("http://localhost:3000/api/auth/me", { cookie: `__session=${jwe}` }));

    expect(res.status).toBe(200);
    const parsed = (await res.json()) as Record<string, unknown>;
    expect(parsed.login).toBe("meperdonas");
    expect(parsed.rate_limit).toBeNull();
  });

  it("returns 401 when there is no session cookie", async () => {
    stubAuthEnv();
    const res = await me.GET(authRequest("http://localhost:3000/api/auth/me"));
    expect(res.status).toBe(401);
  });
});
