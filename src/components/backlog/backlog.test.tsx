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

/** Drive the custom popover select (round 3): open, then pick an option. */
function changeSelect(name: string, optionLabel: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
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

  it("filters by type through the custom select", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login" }));
    await githubItemRepo.upsert(makeGithubItem({ number: 2, kind: "pull", title: "Update deps" }));

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    changeSelect("Type", "Pull requests");

    await waitFor(() => expect(screen.queryByText("Fix login")).not.toBeInTheDocument());
    expect(screen.getByText("Update deps")).toBeInTheDocument();
    expect(backlogItems()).toHaveLength(1);
  });

  it("filters by label through the custom select", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "Fix login", labels: ["bug"] }));
    await githubItemRepo.upsert(
      makeGithubItem({ number: 2, title: "Add theme", labels: ["feature"] }),
    );

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    changeSelect("Label", "bug");

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
    changeSelect("Sort by", "Date created");
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

    changeSelect("Type", "Local");

    await waitFor(() => expect(screen.getByText(/no items match/i)).toBeInTheDocument());
  });
});

describe("Backlog pagination", () => {
  beforeEach(async () => {
    await resetDb();
    window.localStorage.clear();
  });

  async function seedIssues(count: number) {
    for (let index = 1; index <= count; index += 1) {
      await githubItemRepo.upsert(makeGithubItem({ number: index, title: `Card ${index}` }));
    }
  }

  it("hides the pager while everything fits one page (≤25 items)", async () => {
    await seedIssues(25);

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Card 1")).toBeInTheDocument());
    expect(backlogItems()).toHaveLength(25);
    expect(screen.queryByTestId("backlog-pager")).not.toBeInTheDocument();
  });

  it("shows the pager above 25 items and pages through 25-per-page slices", async () => {
    await seedIssues(30);

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Card 1")).toBeInTheDocument());

    const pager = screen.getByTestId("backlog-pager");
    expect(pager).toHaveTextContent("Page 1 of 2");
    expect(backlogItems()).toHaveLength(25);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await waitFor(() => expect(pager).toHaveTextContent("Page 2 of 2"));
    expect(backlogItems()).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    await waitFor(() => expect(pager).toHaveTextContent("Page 1 of 2"));
    expect(backlogItems()).toHaveLength(25);
  });

  it("resets to page 1 whenever a filter changes", async () => {
    await seedIssues(40);

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Card 1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(screen.getByTestId("backlog-pager")).toHaveTextContent("Page 2 of 2"),
    );

    // Re-apply an equivalent type filter: same result set (>25), new view
    // signature — must land back on page 1.
    changeSelect("Type", "Issues");

    await waitFor(() =>
      expect(screen.getByTestId("backlog-pager")).toHaveTextContent("Page 1 of 2"),
    );
  });

  it("changes the page size through the pager's own select", async () => {
    await seedIssues(30);

    renderBacklog();

    await waitFor(() => expect(screen.getByText("Card 1")).toBeInTheDocument());

    changeSelect("Rows per page", "50 / page");

    await waitFor(() => expect(backlogItems()).toHaveLength(30));
    expect(screen.getByTestId("backlog-pager")).toHaveTextContent("Page 1 of 1");
  });

  it("renders the sync control with accessible label in the backlog toolbar", async () => {
    renderBacklog();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sync with GitHub" })).toBeInTheDocument(),
    );
  });
});
