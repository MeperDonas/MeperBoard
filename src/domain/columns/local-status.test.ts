import { describe, expect, it } from "vitest";

import { localStatusStrategy } from "./local-status";

describe("localStatusStrategy", () => {
  it("exposes a stable key", () => {
    expect(localStatusStrategy.key).toBe("local-status");
  });

  it("maps todo to the todo column", () => {
    expect(localStatusStrategy.columnFor("todo")).toBe("todo");
  });

  it("maps doing and in-progress to the in-progress column", () => {
    expect(localStatusStrategy.columnFor("doing")).toBe("in-progress");
    expect(localStatusStrategy.columnFor("in-progress")).toBe("in-progress");
  });

  it("maps done to the done column", () => {
    expect(localStatusStrategy.columnFor("done")).toBe("done");
  });
});
