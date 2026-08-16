import { describe, expect, it, vi } from "vitest";

import * as route from "./route";

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

  it("proxies a GET and returns the upstream body", async () => {
    const upstream = new Response(JSON.stringify([{ number: 1 }]), { status: 200 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstream));
    const previous = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "test-pat";

    try {
      const response = await route.GET(
        new Request("http://localhost/api/github/repos/a/b/issues"),
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
});
