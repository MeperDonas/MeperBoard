import { describe, expect, it } from "vitest";

import type { Column } from "../../data/types";
import type { Board } from "../../state";
import { adjacentColumnId, applyMoves, resolveMove } from "./move";

const columns: Column[] = [
  { id: "backlog", key: "backlog", title: "Backlog", order: 0, strategy: "github-state" },
  { id: "in-review", key: "in-review", title: "In Review", order: 1, strategy: "github-state" },
  { id: "done", key: "done", title: "Done", order: 2, strategy: "github-state" },
];

function makeCard(id: string, columnId: string) {
  return {
    id,
    source: "local" as const,
    type: "local" as const,
    title: id,
    body: "",
    labels: [],
    columnId,
    repo: null,
    number: null,
    state: null,
    htmlUrl: null,
    linkedPrs: [],
    createdAt: "",
    updatedAt: "",
  };
}

const board: Board = {
  columns: [
    { ...columns[0], cards: [makeCard("a", "backlog")] },
    { ...columns[1], cards: [] },
    { ...columns[2], cards: [makeCard("b", "done")] },
  ],
};

describe("adjacentColumnId", () => {
  it("returns the next column id", () => {
    expect(adjacentColumnId(columns, "backlog", 1)).toBe("in-review");
  });

  it("returns the previous column id", () => {
    expect(adjacentColumnId(columns, "done", -1)).toBe("in-review");
  });

  it("returns null at the column boundaries", () => {
    expect(adjacentColumnId(columns, "backlog", -1)).toBeNull();
    expect(adjacentColumnId(columns, "done", 1)).toBeNull();
  });

  it("returns null for an unknown column", () => {
    expect(adjacentColumnId(columns, "nope", 1)).toBeNull();
  });
});

describe("resolveMove", () => {
  it("resolves a move into another column", () => {
    expect(resolveMove(board, "a", "in-review")).toEqual({
      cardId: "a",
      fromColumnId: "backlog",
      toColumnId: "in-review",
    });
  });

  it("returns null for a no-op move into the same column", () => {
    expect(resolveMove(board, "a", "backlog")).toBeNull();
  });

  it("returns null for an unknown target column", () => {
    expect(resolveMove(board, "a", "nope")).toBeNull();
  });

  it("returns null for an unknown card", () => {
    expect(resolveMove(board, "zzz", "in-review")).toBeNull();
  });
});

describe("applyMoves", () => {
  it("relocates a card into its overridden column", () => {
    const moved = applyMoves(board, { a: "done" });
    expect(moved.columns[0].cards).toHaveLength(0);
    expect(moved.columns[2].cards.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("returns the same board instance when there are no moves", () => {
    expect(applyMoves(board, {})).toBe(board);
  });

  it("keeps a card in place when its override targets an unknown column", () => {
    const moved = applyMoves(board, { a: "nope" });
    expect(moved.columns[0].cards.map((c) => c.id)).toEqual(["a"]);
  });
});
