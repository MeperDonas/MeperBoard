import { describe, expect, it } from "vitest";

import {
  clampPage,
  pageCount,
  paginate,
  PAGER_VISIBLE_ABOVE,
  sanitizePageSize,
} from "./pagination";

function letters(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `item-${index + 1}`);
}

describe("sanitizePageSize", () => {
  it("accepts supported sizes and falls back to the default otherwise", () => {
    expect(sanitizePageSize(25)).toBe(25);
    expect(sanitizePageSize(50)).toBe(50);
    expect(sanitizePageSize(100)).toBe(100);
    expect(sanitizePageSize(10)).toBe(25);
    expect(sanitizePageSize(0)).toBe(25);
    expect(sanitizePageSize(-50)).toBe(25);
    expect(sanitizePageSize(Number.NaN)).toBe(25);
  });
});

describe("pageCount", () => {
  it("computes exact and partial pages", () => {
    expect(pageCount(0, 25)).toBe(1);
    expect(pageCount(25, 25)).toBe(1);
    expect(pageCount(26, 25)).toBe(2);
    expect(pageCount(51, 50)).toBe(2);
    expect(pageCount(100, 100)).toBe(1);
    expect(pageCount(101, 100)).toBe(2);
  });

  it("never divides by zero or NaN", () => {
    expect(pageCount(10, Number.NaN)).toBe(1);
    expect(pageCount(Number.NaN, 25)).toBe(1);
  });
});

describe("clampPage", () => {
  it("keeps valid pages untouched", () => {
    expect(clampPage(100, 25, 1)).toBe(1);
    expect(clampPage(100, 25, 4)).toBe(4);
  });

  it("clamps out-of-range requests into range", () => {
    expect(clampPage(30, 25, 9)).toBe(2);
    expect(clampPage(30, 25, -3)).toBe(1);
    expect(clampPage(0, 25, 5)).toBe(1);
    expect(clampPage(10, 25, Number.NaN)).toBe(1);
  });
});

describe("paginate", () => {
  it("slices the requested page with correct metadata", () => {
    const result = paginate(letters(60), 2, 25);
    expect(result.items).toHaveLength(25);
    expect(result.items[0]).toBe("item-26");
    expect(result.page).toBe(2);
    expect(result.totalItems).toBe(60);
    expect(result.totalPages).toBe(3);
  });

  it("returns a short final page", () => {
    const result = paginate(letters(30), 2, 25);
    expect(result.items).toEqual(["item-26", "item-27", "item-28", "item-29", "item-30"]);
  });

  it("clamps stale page indices after the list shrinks (filter → reset safety)", () => {
    const result = paginate(letters(5), 7, 25);
    expect(result.page).toBe(1);
    expect(result.items).toEqual(["item-1", "item-2", "item-3", "item-4", "item-5"]);
  });

  it("handles empty lists without crashing", () => {
    const result = paginate([], 1, 25);
    expect(result).toMatchObject({ items: [], page: 1, totalPages: 1, totalItems: 0 });
  });

  it("does not mutate the source array", () => {
    const items = letters(30);
    paginate(items, 2, 25);
    expect(items).toHaveLength(30);
  });
});

describe("PAGER_VISIBLE_ABOVE", () => {
  it("matches the default page size so lists over 25 always show the pager", () => {
    expect(PAGER_VISIBLE_ABOVE).toBe(25);
  });
});
