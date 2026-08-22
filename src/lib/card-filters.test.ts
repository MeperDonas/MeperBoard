import { describe, expect, it } from "vitest";

import type { Card } from "../state/cards";
import { countByType, filterByTitle, formatCardSummary } from "./card-filters";

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "github:meperdonas/meperboard:1",
    source: "github",
    type: "issue",
    title: "Fix login",
    body: "",
    labels: [],
    columnId: "backlog",
    repo: "meperdonas/meperboard",
    number: 1,
    state: "open",
    htmlUrl: null,
    linkedPrs: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("filterByTitle", () => {
  const cards = [card({ title: "Fix login" }), card({ title: "Add dark theme", id: "b" })];

  it("matches case-insensitively on a substring of the title", () => {
    expect(filterByTitle(cards, "LOGIN").map((c) => c.title)).toEqual(["Fix login"]);
  });

  it("matches every card for an empty or whitespace query", () => {
    expect(filterByTitle(cards, "")).toHaveLength(2);
    expect(filterByTitle(cards, "   ")).toHaveLength(2);
  });

  it("returns nothing when no title matches", () => {
    expect(filterByTitle(cards, "nonexistent")).toEqual([]);
  });
});

describe("countByType and formatCardSummary", () => {
  it("counts each type separately", () => {
    const counts = countByType([
      card(),
      card({ type: "pull", id: "p1" }),
      card({ type: "local", id: "l1" }),
      card({ id: "i2", number: 2 }),
    ]);
    expect(counts).toEqual({ issue: 2, pull: 1, local: 1 });
  });

  it("formats only non-zero segments", () => {
    expect(formatCardSummary({ issue: 128, pull: 0, local: 12 })).toBe("128 issues · 12 local");
    expect(formatCardSummary({ issue: 0, pull: 3, local: 0 })).toBe("3 PRs");
  });

  it("renders 'No items' for an empty board", () => {
    expect(formatCardSummary({ issue: 0, pull: 0, local: 0 })).toBe("No items");
  });
});
