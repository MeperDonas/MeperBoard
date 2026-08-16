import { describe, expect, it } from "vitest";

import { parseSlice } from "./slice-parser";

describe("parseSlice", () => {
  it("parses 'Expenses slice 3' into an epic name and slice number", () => {
    expect(parseSlice("Expenses slice 3")).toEqual({ epic: "Expenses", slice: 3 });
  });

  it("parses multi-word epic names and multi-digit slice numbers", () => {
    expect(parseSlice("Expenses Q3 slice 12")).toEqual({ epic: "Expenses Q3", slice: 12 });
  });

  it("parses the real MeperPOS title format 'X module - slice N: desc'", () => {
    expect(parseSlice("Expenses module - slice 1: CRUD de gastos")).toEqual({
      epic: "Expenses",
      slice: 1,
    });
  });

  it("drops the 'module' suffix from the epic name", () => {
    expect(parseSlice("Expenses module - slice 3: reportes")).toEqual({
      epic: "Expenses",
      slice: 3,
    });
  });

  it("is case-insensitive", () => {
    expect(parseSlice("expenses SLICE 2")).toEqual({ epic: "expenses", slice: 2 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseSlice("  Expenses  slice  5  ")).toEqual({ epic: "Expenses", slice: 5 });
  });

  it("returns null for a title without the slice pattern", () => {
    expect(parseSlice("Fix the login bug")).toBeNull();
  });

  it("returns null when no epic name precedes 'slice N'", () => {
    expect(parseSlice("slice 3")).toBeNull();
  });
});
