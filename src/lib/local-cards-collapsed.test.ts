import { afterEach, describe, expect, it, vi } from "vitest";

import { loadLocalCardsCollapsed, saveLocalCardsCollapsed } from "./local-cards-collapsed";

describe("local cards collapse persistence", () => {
  afterEach(() => {
    // Unstub first: the private-mode test replaces the storage implementation.
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("defaults to expanded when nothing is stored", () => {
    expect(loadLocalCardsCollapsed()).toBe(false);
  });

  it("round-trips a collapsed state", () => {
    saveLocalCardsCollapsed(true);
    expect(loadLocalCardsCollapsed()).toBe(true);
    saveLocalCardsCollapsed(false);
    expect(loadLocalCardsCollapsed()).toBe(false);
  });

  it("treats corrupt values as expanded", () => {
    window.localStorage.setItem("meperboard-localcards-collapsed", "yes-please");
    expect(loadLocalCardsCollapsed()).toBe(false);
  });

  it("survives a throwing localStorage (private mode)", () => {
    const throwing = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: (_key: string, value: string) => {
        throwing.set(_key, value);
        throw new Error("denied");
      },
    });

    expect(() => saveLocalCardsCollapsed(true)).not.toThrow();
    expect(loadLocalCardsCollapsed()).toBe(false);
  });
});
