import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { githubItemRepo, localItemRepo } from "../../data/repositories";
import {
  createTestQueryClient,
  makeGithubItem,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "../../state/test-utils";
import { Backlog } from "./backlog";

function renderBacklog() {
  const client = createTestQueryClient();
  const utils = render(<Backlog />, { wrapper: queryWrapper(client) });
  return { client, ...utils };
}

function backlogItems(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "Backlog items" })).getAllByRole("listitem");
}

function titles(): (string | null)[] {
  return backlogItems().map((li) => within(li).getByTestId("backlog-title").textContent);
}

describe("Backlog", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("renders all cards as a flat list", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login" }));
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk" }));

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    expect(screen.getByText("Buy milk")).toBeInTheDocument();
    expect(backlogItems()).toHaveLength(2);
  });

  it("filters by type", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login" }));
    await githubItemRepo.upsert(makeGithubItem({ number: 2, kind: "pull", title: "Update deps" }));

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "pull" } });

    await waitFor(() => expect(screen.queryByText("Fix login")).not.toBeInTheDocument());
    expect(screen.getByText("Update deps")).toBeInTheDocument();
    expect(backlogItems()).toHaveLength(1);
  });

  it("filters by label", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login", labels: ["bug"] }));
    await githubItemRepo.upsert(
      makeGithubItem({ number: 2, title: "Add theme", labels: ["feature"] }),
    );

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "bug" } });

    await waitFor(() => expect(screen.queryByText("Add theme")).not.toBeInTheDocument());
    expect(screen.getByText("Fix login")).toBeInTheDocument();
    expect(backlogItems()).toHaveLength(1);
  });

  it("sorts by the selected field and direction", async () => {
    await githubItemRepo.upsert(
      makeGithubItem({ number: 1, title: "charlie", synced_at: "2026-08-02T00:00:00Z" }),
    );
    await githubItemRepo.upsert(
      makeGithubItem({ number: 2, title: "alpha", synced_at: "2026-08-03T00:00:00Z" }),
    );
    await githubItemRepo.upsert(
      makeGithubItem({ number: 3, title: "bravo", synced_at: "2026-08-01T00:00:00Z" }),
    );

    renderBacklog();

    await waitFor(() => expect(screen.getByText("charlie")).toBeInTheDocument());

    // Default sort: title ascending.
    expect(titles()).toEqual(["alpha", "bravo", "charlie"]);

    // Sort by created ascending.
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "created" } });
    await waitFor(() => expect(titles()).toEqual(["bravo", "charlie", "alpha"]));

    // Toggle to descending.
    fireEvent.click(screen.getByRole("button", { name: "Toggle sort direction" }));
    await waitFor(() => expect(titles()).toEqual(["alpha", "charlie", "bravo"]));
  });

  it("shows an empty state when the store is empty", async () => {
    renderBacklog();

    await waitFor(() => expect(screen.getByText(/no items yet/i)).toBeInTheDocument());
  });

  it("shows a no-matches state when filters exclude every card", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login" }));

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "local" } });

    await waitFor(() => expect(screen.getByText(/no items match/i)).toBeInTheDocument());
  });
});
