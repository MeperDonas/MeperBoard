import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, queryWrapper } from "../../state/test-utils";
import { useAuth } from "./use-auth";

const account = {
  login: "meperdonas",
  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type FetchHandler = (init?: RequestInit) => Response;

function mockFetch(handlers: Record<string, FetchHandler>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const handler = handlers[url];
    if (!handler) return jsonResponse({ error: "not found" }, 404);
    return handler(init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("useAuth", () => {
  let client: ReturnType<typeof createTestQueryClient>;
  let originalLocation: Location;

  beforeEach(() => {
    client = createTestQueryClient();
    originalLocation = window.location;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("resolves an unauthenticated session to a null user", async () => {
    mockFetch({ "/api/auth/me": () => jsonResponse({}, 401) });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("resolves an authenticated session to the public user", async () => {
    mockFetch({ "/api/auth/me": () => jsonResponse(account) });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual(account);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("exposes the rate_limit from /me when present", async () => {
    const withRateLimit = { ...account, rate_limit: { remaining: 4321, resetAt: 1725000000 } };
    mockFetch({ "/api/auth/me": () => jsonResponse(withRateLimit) });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toMatchObject({
      login: "meperdonas",
      rate_limit: { remaining: 4321, resetAt: 1725000000 },
    });
  });

  it("surfaces a non-auth failure as an error without treating it as authenticated", async () => {
    mockFetch({ "/api/auth/me": () => jsonResponse({ error: "boom" }, 503) });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("navigates to the login route from login()", async () => {
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign, href: originalLocation.href },
    });
    mockFetch({ "/api/auth/me": () => jsonResponse({}, 401) });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.login());
    expect(assign).toHaveBeenCalledWith("/api/auth/login");
  });

  it("clears the auth state after logout()", async () => {
    mockFetch({
      "/api/auth/me": () => jsonResponse(account),
      "/api/auth/logout": () => jsonResponse({ ok: true }),
    });

    const { result } = renderHook(() => useAuth(), { wrapper: queryWrapper(client) });
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(result.current.user).toBeNull();
  });
});
