import { describe, expect, it, vi } from "vitest";

import * as proxyModule from "./proxy";
import {
  GITHUB_API_BASE,
  buildGithubApiUrl,
  isAllowedMethod,
  isAllowedOrigin,
  isAllowedPath,
  proxyGithubRequest,
  resolveToken,
} from "./proxy";

describe("buildGithubApiUrl", () => {
  it("builds an api.github.com URL from path segments", () => {
    expect(buildGithubApiUrl(["repos", "meperdonas", "meperboard", "issues"])).toBe(
      `${GITHUB_API_BASE}/repos/meperdonas/meperboard/issues`,
    );
  });

  it("percent-encodes segments that need it", () => {
    expect(buildGithubApiUrl(["repos", "a b", "x/y", "issues"])).toBe(
      `${GITHUB_API_BASE}/repos/a%20b/x%2Fy/issues`,
    );
  });

  it("appends the query string when one is provided", () => {
    expect(buildGithubApiUrl(["repos", "a", "b", "issues"], "state=all&per_page=100")).toBe(
      `${GITHUB_API_BASE}/repos/a/b/issues?state=all&per_page=100`,
    );
  });

  it("omits the query string when it is empty or absent", () => {
    expect(buildGithubApiUrl(["repos", "a", "b", "issues"], "")).toBe(
      `${GITHUB_API_BASE}/repos/a/b/issues`,
    );
    expect(buildGithubApiUrl(["repos", "a", "b", "issues"])).toBe(
      `${GITHUB_API_BASE}/repos/a/b/issues`,
    );
  });
});

describe("isAllowedMethod", () => {
  it("allows only GET", () => {
    expect(isAllowedMethod("GET")).toBe(true);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(isAllowedMethod(method)).toBe(false);
    }
  });
});

describe("resolveToken", () => {
  it("returns the GITHUB_TOKEN when set", () => {
    expect(resolveToken({ GITHUB_TOKEN: "pat" })).toBe("pat");
  });

  it("returns null when GITHUB_TOKEN is unset", () => {
    expect(resolveToken({})).toBeNull();
  });
});

describe("shell/subprocess boundary", () => {
  it("no longer exposes a gh-auth-token subprocess helper", () => {
    expect((proxyModule as Record<string, unknown>).getGhAuthToken).toBeUndefined();
  });
});

describe("isAllowedOrigin", () => {
  it("accepts an Origin matching the allowlist", () => {
    expect(isAllowedOrigin("https://meperboard.vercel.app", undefined, "https://meperboard.vercel.app")).toBe(true);
  });

  it("rejects an Origin not in the allowlist", () => {
    expect(isAllowedOrigin("https://evil.example.com", undefined, "https://meperboard.vercel.app")).toBe(false);
  });

  it("accepts a Referer under the allowed origin when Origin is absent", () => {
    expect(isAllowedOrigin(undefined, "https://meperboard.vercel.app/board", "https://meperboard.vercel.app")).toBe(true);
  });

  it("rejects when both Origin and Referer are absent", () => {
    expect(isAllowedOrigin(undefined, undefined, "https://meperboard.vercel.app")).toBe(false);
  });

  it("accepts any of several allowlisted origins (dev + prod)", () => {
    const allowed = "http://localhost:3000, https://meperboard.vercel.app";
    expect(isAllowedOrigin("http://localhost:3000", undefined, allowed)).toBe(true);
    expect(isAllowedOrigin("https://meperboard.vercel.app", undefined, allowed)).toBe(true);
  });
});

describe("isAllowedPath", () => {
  it("allows repos/{owner}/{repo}/issues", () => {
    expect(isAllowedPath(["repos", "meperdonas", "meperboard", "issues"])).toBe(true);
  });

  it("allows repos/{owner}/{repo}/pulls", () => {
    expect(isAllowedPath(["repos", "meperdonas", "meperboard", "pulls"])).toBe(true);
  });

  it("allows a single-item issue path variant", () => {
    expect(isAllowedPath(["repos", "meperdonas", "meperboard", "issues", "56"])).toBe(true);
  });

  it("allows the live repo-list path user/repos for the switcher", () => {
    expect(isAllowedPath(["user", "repos"])).toBe(true);
  });

  it("allows the profile path user for the switcher", () => {
    expect(isAllowedPath(["user"])).toBe(true);
  });

  it("rejects other user/* paths that are not the switcher endpoints", () => {
    expect(isAllowedPath(["user", "orgs"])).toBe(false);
    expect(isAllowedPath(["user", "repos", "extra"])).toBe(false);
  });

  it("rejects unrelated resource paths", () => {
    expect(isAllowedPath(["repos", "meperdonas", "meperboard", "comments"])).toBe(false);
  });

  it("rejects a path missing the resource segment", () => {
    expect(isAllowedPath(["repos", "meperdonas", "meperboard"])).toBe(false);
  });
});

describe("proxyGithubRequest", () => {
  it("rejects non-GET methods without calling the fetcher", async () => {
    const fetcher = vi.fn();
    const result = await proxyGithubRequest({
      path: ["repos", "a", "b", "issues"],
      method: "POST",
      token: null,
      fetcher,
    });

    expect(result.status).toBe(405);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("forwards GET with the bearer token and accept headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await proxyGithubRequest({
      path: ["repos", "a", "b", "issues"],
      method: "GET",
      token: "pat",
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GITHUB_API_BASE}/repos/a/b/issues`);
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer pat");
  });

  it("omits the authorization header for anonymous requests", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await proxyGithubRequest({
      path: ["repos", "a", "b", "issues"],
      method: "GET",
      token: null,
      fetcher,
    });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("forwards rate-limit headers on success", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("[]", { status: 200, headers: { "x-ratelimit-remaining": "57" } }),
    );
    const result = await proxyGithubRequest({
      path: ["r"],
      method: "GET",
      token: null,
      fetcher,
    });

    expect(result.status).toBe(200);
    expect(result.headers["x-ratelimit-remaining"]).toBe("57");
  });

  it("surfaces a rate-limited upstream response as 429 sync-paused", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "API rate limit exceeded" }), { status: 403 }),
    );
    const result = await proxyGithubRequest({
      path: ["r"],
      method: "GET",
      token: null,
      fetcher,
    });

    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({ error: "sync paused", rate_limited: true });
  });

  it("forwards the query string to the upstream URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    await proxyGithubRequest({
      path: ["repos", "a", "b", "issues"],
      query: "state=all&per_page=100",
      method: "GET",
      token: null,
      fetcher,
    });

    const [url] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${GITHUB_API_BASE}/repos/a/b/issues?state=all&per_page=100`);
  });

  it("forwards the Link pagination header from the upstream response", async () => {
    const link = `<https://api.github.com/repos/a/b/issues?page=2>; rel="next"`;
    const fetcher = vi.fn().mockResolvedValue(
      new Response("[]", { status: 200, headers: { link } }),
    );
    const result = await proxyGithubRequest({
      path: ["r"],
      method: "GET",
      token: null,
      fetcher,
    });

    expect(result.headers.link).toBe(link);
  });
});
