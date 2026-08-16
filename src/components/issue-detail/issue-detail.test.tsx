import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { githubItemRepo } from "../../data/repositories";
import type { RepoId } from "../../data/types";
import { createTestQueryClient, makeGithubItem, queryWrapper, resetDb } from "../../state/test-utils";
import { IssueDetail, type IssueDetailProps } from "./issue-detail";

const REPO: RepoId = "meperdonas/meperboard";

function renderDetail(props: IssueDetailProps = {}) {
  const client = createTestQueryClient();
  const utils = render(<IssueDetail {...props} />, { wrapper: queryWrapper(client) });
  return { client, ...utils };
}

describe("IssueDetail", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("renders read-only title, body, labels, state, and linked PRs", async () => {
    await githubItemRepo.upsert(
      makeGithubItem({
        number: 7,
        title: "Fix auth",
        body: "details here",
        state: "open",
        labels: ["bug", "security"],
        linked_prs: [12, 34],
      }),
    );

    renderDetail({ repo: REPO, number: 7 });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Fix auth" })).toBeInTheDocument(),
    );

    expect(screen.getByText("details here")).toBeInTheDocument();
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("#34")).toBeInTheDocument();
  });

  it("renders placeholders for empty body, labels, and linked PRs", async () => {
    await githubItemRepo.upsert(
      makeGithubItem({ number: 7, title: "Empty issue", body: "", labels: [], linked_prs: [] }),
    );

    renderDetail({ repo: REPO, number: 7 });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Empty issue" })).toBeInTheDocument(),
    );

    expect(screen.getByText("No description provided.")).toBeInTheDocument();
    expect(screen.getByText("No labels.")).toBeInTheDocument();
    expect(screen.getByText("No linked pull requests.")).toBeInTheDocument();
  });

  it("offers no mutation controls", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 7, title: "Read only" }));

    renderDetail({ repo: REPO, number: 7 });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Read only" })).toBeInTheDocument(),
    );

    // No buttons, text inputs, or selects — the detail is strictly read-only.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    // No create / edit / close / re-label affordances (exact-match text).
    for (const text of ["Edit", "Create", "Close", "Re-label", "Save"]) {
      expect(screen.queryByText(text)).not.toBeInTheDocument();
    }
  });

  it("prompts to select an issue when none is selected", () => {
    renderDetail({});

    expect(screen.getByText(/select an issue/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows a not-found message for a missing issue", async () => {
    renderDetail({ repo: REPO, number: 999 });

    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
  });
});
