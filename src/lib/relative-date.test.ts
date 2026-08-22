import { describe, expect, it } from "vitest";

import { formatRelativeShort } from "./relative-date";

const NOW = Date.parse("2026-08-21T12:00:00Z");

describe("formatRelativeShort", () => {
  it("returns 'now' for timestamps inside the current minute", () => {
    expect(formatRelativeShort("2026-08-21T11:59:30Z", NOW)).toBe("now");
  });

  it("renders minutes below an hour", () => {
    expect(formatRelativeShort("2026-08-21T11:42:00Z", NOW)).toBe("18m");
  });

  it("renders hours below a day", () => {
    expect(formatRelativeShort("2026-08-21T06:00:00Z", NOW)).toBe("6h");
  });

  it("renders days below a month", () => {
    expect(formatRelativeShort("2026-08-18T12:00:00Z", NOW)).toBe("3d");
  });

  it("renders months below a year", () => {
    expect(formatRelativeShort("2026-05-22T12:00:00Z", NOW)).toBe("3mo");
  });

  it("renders years at or beyond one year", () => {
    expect(formatRelativeShort("2025-08-21T12:00:00Z", NOW)).toBe("1y");
  });

  it("clamps future timestamps to 'now'", () => {
    expect(formatRelativeShort("2026-08-21T13:00:00Z", NOW)).toBe("now");
  });

  it("returns '' for invalid input instead of inventing data", () => {
    expect(formatRelativeShort("not-a-date", NOW)).toBe("");
  });
});
