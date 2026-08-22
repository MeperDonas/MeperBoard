import { describe, expect, it } from "vitest";

import { flattenGroups, groupCards, type BacklogGroupable } from "./backlog-groups";

function card(overrides: Partial<BacklogGroupable> & { id?: string } = {}): BacklogGroupable & {
  id: string;
} {
  return {
    id: "github:meperdonas/meperboard:1",
    type: "issue",
    source: "github",
    state: "open",
    ...overrides,
  };
}

describe("groupCards", () => {
  it("returns one unlabeled group for 'none'", () => {
    const cards = [card(), card({ id: "b" })];
    const groups = groupCards(cards, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("");
    expect(groups[0].cards).toHaveLength(2);
  });

  it("groups by type in fixed order and labels each bucket", () => {
    const groups = groupCards(
      [
        card({ id: "l1", type: "local", source: "local", state: null }),
        card({ id: "p1", type: "pull" }),
        card({ id: "i1" }),
        card({ id: "p2", type: "pull" }),
      ],
      "type",
    );

    expect(groups.map((g) => [g.key, g.label, g.cards.length])).toEqual([
      ["issue", "Issues", 1],
      ["pull", "Pull requests", 2],
      ["local", "Local", 1],
    ]);
  });

  it("groups by state with open first and preserves unknown states", () => {
    const groups = groupCards(
      [
        card({ id: "c1", state: "closed" }),
        card({ id: "w1", state: "weird" }),
        card({ id: "o1", state: "open" }),
        card({ id: "n1", state: null }),
      ],
      "state",
    );

    expect(groups.map((g) => g.key)).toEqual(["open", "closed", "weird", ""]);
    expect(groups.find((g) => g.key === "")?.label).toBe("");
  });

  it("groups by source with github before local", () => {
    const groups = groupCards(
      [
        card({ id: "l1", source: "local", type: "local", state: null }),
        card({ id: "g1" }),
      ],
      "source",
    );
    expect(groups.map((g) => g.key)).toEqual(["github", "local"]);
    expect(groups[0].label).toBe("Github");
  });

  it("groups by column in fixed workflow order and labels each bucket", () => {
    const groups = groupCards(
      [
        card({ id: "d1", columnId: "done" }),
        card({ id: "t1", columnId: "todo" }),
        card({ id: "r1", columnId: "in-review" }),
      ],
      "column",
    );
    expect(groups.map((g) => [g.key, g.label, g.cards.length])).toEqual([
      ["todo", "To Do", 1],
      ["in-review", "In Review", 1],
      ["done", "Done", 1],
    ]);
  });

  it("preserves input order within groups (caller sorts first)", () => {
    const groups = groupCards([card({ id: "z" }), card({ id: "a" })], "type");
    expect(groups[0].cards.map((c) => c.id)).toEqual(["z", "a"]);
  });
});

describe("flattenGroups", () => {
  it("emits header + rows per labeled group", () => {
    const entries = flattenGroups(
      groupCards(
        [
          card({ id: "i1" }),
          card({ id: "p1", type: "pull" }),
          card({ id: "l1", type: "local", source: "local", state: null }),
        ],
        "type",
      ),
    );

    expect(entries.map((e) => e.kind)).toEqual(["header", "row", "header", "row", "header", "row"]);
    const header = entries[0];
    if (header.kind !== "header") throw new Error("expected header first");
    expect(header.label).toBe("Issues");
    expect(header.count).toBe(1);
    expect(entries[1]).toMatchObject({ kind: "row", id: "row:i1" });
  });

  it("emits only rows when grouping is off", () => {
    const entries = flattenGroups(groupCards([card(), card({ id: "b" })], "none"));
    expect(entries.every((e) => e.kind === "row")).toBe(true);
    expect(entries).toHaveLength(2);
  });

  it("keeps row ids stable via the card id", () => {
    const entries = flattenGroups(groupCards([card({ id: "custom-id" })], "none"));
    expect(entries[0]).toMatchObject({ kind: "row", id: "row:custom-id" });
  });
});
