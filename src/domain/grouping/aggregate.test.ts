import { describe, expect, it } from "vitest";

import { aggregateSlices, type SliceEpic } from "./aggregate";

const epics: SliceEpic[] = [
  { id: "e1", title: "Expenses" },
  { id: "e2", title: "Expenses Q3" },
];

describe("aggregateSlices", () => {
  it("groups 'Expenses slice 1..5' under a single Expenses epic", () => {
    const items = [1, 2, 3, 4, 5].map((n) => ({ id: `i${n}`, title: `Expenses slice ${n}` }));

    const { groups, ungrouped } = aggregateSlices(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].epicId).toBeNull();
    expect(groups[0].epicTitle).toBe("Expenses");
    expect(groups[0].slices.map((s) => s.slice)).toEqual([1, 2, 3, 4, 5]);
    expect(ungrouped).toEqual([]);
  });

  it("keeps non-slice items top-level and ungrouped", () => {
    const items = [
      { id: "a", title: "Expenses slice 1" },
      { id: "b", title: "Fix the login bug" },
    ];

    const { groups, ungrouped } = aggregateSlices(items);

    expect(groups).toHaveLength(1);
    expect(ungrouped).toEqual([{ id: "b", title: "Fix the login bug" }]);
  });

  it("attaches a slice to the most specific matching epic", () => {
    const items = [
      { id: "q3", title: "Expenses Q3 slice 2" },
      { id: "gen", title: "Expenses slice 1" },
    ];

    const { groups } = aggregateSlices(items, epics);

    const q3 = groups.find((g) => g.epicTitle === "Expenses Q3");
    const general = groups.find((g) => g.epicTitle === "Expenses");

    expect(q3?.epicId).toBe("e2");
    expect(general?.epicId).toBe("e1");
  });

  it("prefers the longest epic title when only prefixes match", () => {
    const items = [{ id: "x", title: "Expenses Q3 Backend slice 1" }];

    const { groups } = aggregateSlices(items, epics);

    expect(groups).toHaveLength(1);
    expect(groups[0].epicId).toBe("e2");
    expect(groups[0].epicTitle).toBe("Expenses Q3");
  });

  it("synthesizes an epic when no known epic matches", () => {
    const items = [{ id: "b1", title: "Budget slice 1" }];

    const { groups } = aggregateSlices(items, epics);

    expect(groups).toHaveLength(1);
    expect(groups[0].epicId).toBeNull();
    expect(groups[0].epicTitle).toBe("Budget");
  });

  it("merges slices that resolve to the same epic into one group without duplication", () => {
    const items = [
      { id: "a", title: "Expenses Q3 slice 1" },
      { id: "b", title: "Expenses Q3 Backend slice 2" },
    ];

    const { groups } = aggregateSlices(items, epics);

    expect(groups).toHaveLength(1);
    expect(groups[0].epicId).toBe("e2");
    expect(groups[0].slices).toHaveLength(2);
  });

  it("never duplicates a slice item by id", () => {
    const items = [
      { id: "dup", title: "Expenses slice 1" },
      { id: "dup", title: "Expenses slice 1" },
    ];

    const { groups } = aggregateSlices(items);

    expect(groups).toHaveLength(1);
    expect(groups[0].slices).toHaveLength(1);
  });

  it("sorts groups and slices deterministically", () => {
    const items = [
      { id: "b2", title: "Budget slice 2" },
      { id: "e1", title: "Expenses slice 1" },
      { id: "b1", title: "Budget slice 1" },
    ];

    const { groups } = aggregateSlices(items);

    expect(groups.map((g) => g.epicTitle)).toEqual(["Budget", "Expenses"]);
    expect(groups[0].slices.map((s) => s.slice)).toEqual([1, 2]);
  });
});
