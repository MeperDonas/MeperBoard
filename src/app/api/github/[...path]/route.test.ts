import { describe, expect, it, vi } from "vitest";

import * as route from "./route";

const ALLOWED_ORIGIN = "http://localhost:3000";

function githubRequest(
  url: string,
  headers: Record<string, string> = { origin: ALLOWED_ORIGIN },
): Request {
  return new Request(url, { headers });
}

describe("github proxy route", () => {
  it("exports a GET handler", () => {
    expect(typeof route.GET).toBe("function");
  });

  it("is GET-only: no POST/PATCH/PUT/DELETE handlers are exported", () => {
    const handlers = route as unknown as Record<string, unknown>;
    expect(handlers.POST).toBeUndefined();
    expect(handlers.PATCH).toBeUndefined();
    expect(handlers.PUT).toBeUndefined();
    expect(handlers.DELETE).toBeUndefined();
  });

  it("runs on the edge runtime", () => {
    expect((route as unknown as Record<string, string>).runtime).toBe("edge");
  });

  it("rejects a request without a matching Origin/Referer with 403 and no upstream call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      const response = await route.GET(
        githubRequest("http://localhost/api/github/repos/a/b/issues", { origin: "https://evil.example.com" }),
        { params: Promise.resolve({ path: ["repos", "a", "b", "issues"] }) },
      );

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });

  it("rejects a path outside the allowlist with 404 and no upstream call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      const response = await route.GET(
        githubRequest("http://localhost/api/github/user/repos"),
        { params: Promise.resolve({ path: ["user", "repos"] }) },
      );

      expect(response.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });

  it("proxies a GET and returns the upstream body", async () => {
    const upstream = new Response(JSON.stringify([{ number: 1 }]), { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      const response = await route.GET(
        githubRequest("http://localhost/api/github/repos/a/b/issues"),
        { params: Promise.resolve({ path: ["repos", "a", "b", "issues"] }) },
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([{ number: 1 }]);
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });

  it("forwards the request query string to the upstream URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      await route.GET(
        githubRequest("http://localhost/api/github/repos/a/b/issues?state=all&per_page=100"),
        { params: Promise.resolve({ path: ["repos", "a", "b", "issues"] }) },
      );

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.github.com/repos/a/b/issues?state=all&per_page=100");
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });

  it("forwards the upstream Link header to the client", async () => {
    const link = `<https://api.github.com/repos/a/b/issues?page=2>; rel="next"`;
    const upstream = new Response(JSON.stringify([{ number: 1 }]), {
      status: 200,
      headers: { link },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      const response = await route.GET(
        githubRequest("http://localhost/api/github/repos/a/b/issues"),
        { params: Promise.resolve({ path: ["repos", "a", "b", "issues"] }) },
      );

      expect(response.headers.get("link")).toBe(link);
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = previous;
    }
  });
});
