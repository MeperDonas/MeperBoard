import { afterEach, describe, expect, it, vi } from "vitest";

import { GITHUB_TOKEN_URL, refreshAccessToken } from "./oauth";

const CLIENT_ID = "Iv1.client";
const CLIENT_SECRET = "client-secret-001";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshAccessToken", () => {
  it("POSTs the refresh_token to the GitHub access_token endpoint and returns new tokens", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "ghu_new",
            refresh_token: "ghr_new",
            expires_in: 28800,
            token_type: "bearer",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshAccessToken({
      refreshToken: "ghr_old",
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    expect(result).toEqual({
      access_token: "ghu_new",
      refresh_token: "ghr_new",
      expires_in: 28800,
    });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GITHUB_TOKEN_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Accept"]).toBe("application/json");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("ghr_old");
    expect(body.get("client_id")).toBe(CLIENT_ID);
    expect(body.get("client_secret")).toBe(CLIENT_SECRET);
  });

  it("returns null when GitHub returns an error payload", async () => {
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

    expect(
      await refreshAccessToken({ refreshToken: "bad", clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    ).toBeNull();
  });

  it("returns null when the response is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("not json", { status: 200 }))));

    expect(
      await refreshAccessToken({ refreshToken: "r", clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    ).toBeNull();
  });

  it("returns null when the parsed body lacks a refresh_token or expires_in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ access_token: "ghu_only" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    );

    expect(
      await refreshAccessToken({ refreshToken: "r", clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
    ).toBeNull();
  });
});
