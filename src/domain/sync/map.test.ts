import { describe, expect, it } from "vitest";

import { mapIssue, type RawGithubIssue } from "./map";

function rawIssue(overrides: Partial<RawGithubIssue> = {}): RawGithubIssue {
  return {
    number: 1,
    title: "Add login",
    body: "Login for the board",
    state: "open",
    html_url: "https://github.com/meperdonas/meperboard/issues/1",
    updated_at: "2026-08-01T00:00:00Z",
    labels: [{ name: "bug" }, { name: "sync" }],
    ...overrides,
  };
}

describe("mapIssue", () => {
  it("maps a GitHub issue to a GithubItem with kind issue", () => {
    const item = mapIssue("meperdonas/meperboard", rawIssue(), "2026-08-15T00:00:00Z");

    expect(item).toMatchObject({
      repo: "meperdonas/meperboard",
      number: 1,
      kind: "issue",
      title: "Add login",
      body: "Login for the board",
      state: "open",
      html_url: "https://github.com/meperdonas/meperboard/issues/1",
      github_updated_at: "2026-08-01T00:00:00Z",
      synced_at: "2026-08-15T00:00:00Z",
      column_id: null,
    });
  });

  it("flags a pull request by the presence of pull_request", () => {
    const item = mapIssue("r", rawIssue({ pull_request: { url: "https://api.github.com/pulls/2" } }), "s");

    expect(item.kind).toBe("pull");
  });

  it("flattens labels to names and drops empty ones", () => {
    const item = mapIssue(
      "r",
      rawIssue({ labels: [{ name: "bug" }, { name: "" }, "enhancement", {}] }),
      "s",
    );

    expect(item.labels).toEqual(["bug", "enhancement"]);
  });

  it("coalesces a null body to an empty string", () => {
    const item = mapIssue("r", rawIssue({ body: null }), "s");

    expect(item.body).toBe("");
  });

  it("coalesces a missing title and url to empty strings", () => {
    const item = mapIssue("r", rawIssue({ title: null, html_url: null }), "s");

    expect(item.title).toBe("");
    expect(item.html_url).toBe("");
  });

  it("seeds linked_prs empty (cross-ref heuristic deferred)", () => {
    const item = mapIssue("r", rawIssue(), "s");

    expect(item.linked_prs).toEqual([]);
  });
});
