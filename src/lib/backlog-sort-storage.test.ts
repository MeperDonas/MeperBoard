import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BACKLOG_SORT_STORAGE_KEY,
  loadStoredBacklogSort,
  saveBacklogSort,
} from "./backlog-sort-storage";

describe("backlog sort persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a valid sort", () => {
    saveBacklogSort({ field: "updated", direction: "desc" });
    expect(loadStoredBacklogSort()).toEqual({ field: "updated", direction: "desc" });
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredBacklogSort()).toBeNull();
  });

  it("rejects an unknown field", () => {
    window.localStorage.setItem(
      BACKLOG_SORT_STORAGE_KEY,
      JSON.stringify({ field: "hacker", direction: "asc" }),
    );
    expect(loadStoredBacklogSort()).toBeNull();
  });

  it("rejects an unknown direction", () => {
    window.localStorage.setItem(
      BACKLOG_SORT_STORAGE_KEY,
      JSON.stringify({ field: "title", direction: "sideways" }),
    );
    expect(loadStoredBacklogSort()).toBeNull();
  });

  it("accepts a missing direction (defaults apply downstream)", () => {
    window.localStorage.setItem(BACKLOG_SORT_STORAGE_KEY, JSON.stringify({ field: "created" }));
    expect(loadStoredBacklogSort()).toEqual({ field: "created" });
  });
});
