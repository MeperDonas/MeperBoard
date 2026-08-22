import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_TTL,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  buildAuthStateCookie,
  buildSessionCookie,
  buildSessionJwe,
  clearSessionCookie,
  createSession,
  deriveKey,
  getAuthSecret,
  readAuthState,
  readSessionJwe,
  shouldRefresh,
} from "./session";

const SECRET = "0123456789abcdef0123456789abcdef";
const otherSecret = "another-secret-that-is-also-32-bytes-long";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

describe("createSession", () => {
  it("builds a payload with iat now and exp exactly ACCESS_TOKEN_TTL later", () => {
    const now = nowSec();
    const payload = createSession(
      { token: "ghu_1", refresh_token: "ghr_1", login: "meperdonas", avatar_url: "https://a.example/u.png" },
      now,
    );
    expect(payload.token).toBe("ghu_1");
    expect(payload.refresh_token).toBe("ghr_1");
    expect(payload.login).toBe("meperdonas");
    expect(payload.avatar_url).toBe("https://a.example/u.png");
    expect(payload.iat).toBe(now);
    expect(payload.exp).toBe(now + ACCESS_TOKEN_TTL);
  });

  it("defaults iat/exp to the current time when now is omitted", () => {
    const before = nowSec();
    const payload = createSession({ token: "t", refresh_token: "r", login: "l", avatar_url: "u" });
    const after = nowSec();
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.iat).toBeLessThanOrEqual(after);
    expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL);
  });
});

describe("buildSessionJwe / readSessionJwe", () => {
  it("round-trips an unexpired session and preserves every claim", async () => {
    const now = nowSec();
    const payload = createSession(
      { token: "ghu_123", refresh_token: "ghr_456", login: "meperdonas", avatar_url: "https://a.example/u.png" },
      now,
    );
    const header = `__session=${await buildSessionJwe(payload, SECRET)}; other=1`;
    const read = await readSessionJwe(header, SECRET);
    expect(read).not.toBeNull();
    expect(read!.token).toBe("ghu_123");
    expect(read!.refresh_token).toBe("ghr_456");
    expect(read!.login).toBe("meperdonas");
    expect(read!.avatar_url).toBe("https://a.example/u.png");
    expect(read!.iat).toBe(now);
    expect(read!.exp).toBe(now + ACCESS_TOKEN_TTL);
  });

  it("returns null for a cookie header without __session", async () => {
    expect(await readSessionJwe("", SECRET)).toBeNull();
    expect(await readSessionJwe("foo=1; bar=2", SECRET)).toBeNull();
  });

  it("returns null when decrypted with a different secret", async () => {
    const payload = createSession({ token: "t", refresh_token: "r", login: "l", avatar_url: "u" }, nowSec());
    const header = `__session=${await buildSessionJwe(payload, SECRET)}`;
    expect(await readSessionJwe(header, otherSecret)).toBeNull();
  });

  it("returns null for an expired token that is still valid JSON", async () => {
    const exp = nowSec() - 3600;
    const header = `__session=${await buildSessionJwe(
      { token: "ghu_old", refresh_token: "ghr_old", login: "meperdonas", avatar_url: "u", iat: exp - 1, exp },
      SECRET,
    )}`;
    expect(await readSessionJwe(header, SECRET)).toBeNull();
  });
});

describe("shouldRefresh", () => {
  const now = nowSec();

  it("returns true when exp is within the 30-minute window", () => {
    expect(shouldRefresh(now + 10 * 60, now)).toBe(true);
  });

  it("returns true when exp has already passed", () => {
    expect(shouldRefresh(now - 5, now)).toBe(true);
  });

  it("returns false when exp is more than 30 minutes away", () => {
    expect(shouldRefresh(now + 60 * 60, now)).toBe(false);
  });
});

describe("buildSessionCookie", () => {
  it("serializes a Set-Cookie with all required attributes and default max-age", () => {
    const cookie = buildSessionCookie("eyJ.jwe");
    expect(cookie).toContain(`${SESSION_COOKIE}=eyJ.jwe`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain(`Max-Age=${SESSION_MAX_AGE}`);
  });

  it("honors a custom maxAge", () => {
    expect(buildSessionCookie("jwe", 600)).toContain("Max-Age=600");
  });
});

describe("clearSessionCookie", () => {
  it("produces an empty session value with Max-Age=0", () => {
    const cookie = clearSessionCookie();
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});

describe("deriveKey", () => {
  it("derives a deterministic 32-byte key from a secret", async () => {
    const a = await deriveKey(SECRET);
    const b = await deriveKey(SECRET);
    expect(a).toHaveLength(32);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("derives a different key for a different secret", async () => {
    const a = await deriveKey(SECRET);
    const b = await deriveKey(otherSecret);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });
});

describe("buildAuthStateCookie / readAuthState", () => {
  it("round-trips a state value", async () => {
    const cookie = await buildAuthStateCookie("state-abc-123", SECRET);
    expect(cookie).toContain("__auth_state=");
    expect(await readAuthState(cookie, SECRET)).toBe("state-abc-123");
  });

  it("returns null when the state cookie is absent or tampered", async () => {
    expect(await readAuthState("", SECRET)).toBeNull();
    const cookie = await buildAuthStateCookie("s1", SECRET);
    const jwe = cookie.slice(cookie.indexOf("=") + 1).split(";")[0];
    const tampered = (jwe[0] === "A" ? "B" : "A") + jwe.slice(1);
    expect(await readAuthState(`__auth_state=${tampered}`, SECRET)).toBeNull();
  });
});

describe("getAuthSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws in production when AUTH_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => getAuthSecret()).toThrow(/AUTH_SECRET/);
  });

  it("throws in production when AUTH_SECRET is shorter than 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "short-secret");
    expect(() => getAuthSecret()).toThrow(/32/);
  });

  it("returns the secret when it is at least 32 chars", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", SECRET);
    expect(getAuthSecret()).toBe(SECRET);
  });

  it("returns a dev fallback with a warning when missing outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const fallback = getAuthSecret();
      expect(fallback.length).toBeGreaterThanOrEqual(32);
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });
});
