import { describe, expect, it } from "vitest";

import {
  remainingCardCount,
  shouldVirtualize,
  visibleCardCount,
} from "./capping";

describe("visibleCardCount", () => {
  it("renders every card below the initial cap", () => {
    expect(visibleCardCount(10, 0)).toBe(10);
  });

  it("caps the initial render at the initial cap", () => {
    expect(visibleCardCount(120, 0)).toBe(40);
  });

  it("expands by the step size for each expansion", () => {
    expect(visibleCardCount(500, 1)).toBe(140);
    expect(visibleCardCount(500, 3)).toBe(340);
  });

  it("never exceeds the total even when over-expanded", () => {
    expect(visibleCardCount(150, 99)).toBe(150);
  });

  it("treats invalid input as zero", () => {
    expect(visibleCardCount(0, 2)).toBe(0);
    expect(visibleCardCount(-5, 2)).toBe(0);
    expect(visibleCardCount(Number.NaN, 2)).toBe(0);
  });
});

describe("remainingCardCount", () => {
  it("counts hidden cards behind the footer", () => {
    expect(remainingCardCount(120, 0)).toBe(80);
  });

  it("shrinks as the column expands", () => {
    expect(remainingCardCount(120, 1)).toBe(0);
  });

  it("is zero when everything is visible or the input is empty", () => {
    expect(remainingCardCount(20, 0)).toBe(0);
    expect(remainingCardCount(0, 0)).toBe(0);
  });
});

describe("shouldVirtualize", () => {
  it("keeps small lists on the plain path", () => {
    expect(shouldVirtualize(0)).toBe(false);
    expect(shouldVirtualize(80)).toBe(false);
  });

  it("virtualizes large lists", () => {
    expect(shouldVirtualize(81)).toBe(true);
    expect(shouldVirtualize(1000)).toBe(true);
  });
});
