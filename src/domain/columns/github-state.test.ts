import { describe, expect, it } from "vitest";

import { githubStateStrategy } from "./github-state";

describe("githubStateStrategy", () => {
  it("exposes a stable key", () => {
    expect(githubStateStrategy.key).toBe("github-state");
  });

  it("maps an open issue to Backlog", () => {
    expect(githubStateStrategy.columnFor({ kind: "issue", state: "open" })).toBe("backlog");
  });

  it("maps a closed issue to Done", () => {
    expect(githubStateStrategy.columnFor({ kind: "issue", state: "closed" })).toBe("done");
  });

  it("maps an open, non-draft PR to In Review", () => {
    expect(
      githubStateStrategy.columnFor({ kind: "pull", state: "open", draft: false, merged: false }),
    ).toBe("in-review");
  });

  it("maps a merged PR to Done", () => {
    expect(
      githubStateStrategy.columnFor({ kind: "pull", state: "closed", draft: false, merged: true }),
    ).toBe("done");
  });

  it("maps a draft PR to Draft", () => {
    expect(
      githubStateStrategy.columnFor({ kind: "pull", state: "open", draft: true, merged: false }),
    ).toBe("draft");
  });

  it("maps a closed, unmerged PR to Done", () => {
    expect(
      githubStateStrategy.columnFor({ kind: "pull", state: "closed", draft: false, merged: false }),
    ).toBe("done");
  });
});
