import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubItemRepo, localItemRepo, repoRepo } from "../../data/repositories";
import {
  createTestQueryClient,
  makeGithubItem,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "../../state/test-utils";
import { Board, type BoardProps } from "./board";

const COLUMN_TITLES = ["Backlog", "In Review", "Draft", "Done", "To Do", "Doing"];

function renderBoard(props: BoardProps = {}) {
  const client = createTestQueryClient();
  const utils = render(<Board {...props} />, { wrapper: queryWrapper(client) });
  return { client, ...utils };
}

function columnSection(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;
}

describe("Board", () => {
  beforeEach(async () => {
    await resetDb();
    await repoRepo.setActive("meperdonas", "meperboard");
  });

  it("renders ordered columns with cards resolved from useBoard", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, state: "open", title: "Fix login" }));
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk", column_id: "todo" }));

    renderBoard();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    expect(screen.getByRole("region", { name: "Kanban board" })).toBeInTheDocument();

    for (const title of COLUMN_TITLES) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    // GitHub issue (open) lands in Backlog; local card lands in To Do.
    expect(within(columnSection("Backlog")).getByText("Fix login")).toBeInTheDocument();
    expect(within(columnSection("To Do")).getByText("Buy milk")).toBeInTheDocument();
  });

  it("marks local cards with a visible Local badge and GitHub cards with their type", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, state: "open", title: "Fix login" }));
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk", column_id: "todo" }));

    renderBoard();

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());

    const localCard = screen.getByText("Buy milk").closest("li") as HTMLElement;
    expect(within(localCard).getByText("Local")).toBeInTheDocument();

    const githubCard = screen.getByText("Fix login").closest("li") as HTMLElement;
    expect(within(githubCard).queryByText("Local")).not.toBeInTheDocument();
    expect(within(githubCard).getByText("Issue")).toBeInTheDocument();
  });

  it("renders empty columns and an empty state when the store is empty", async () => {
    renderBoard();

    await waitFor(() => expect(screen.getByText(/no cards yet/i)).toBeInTheDocument());

    for (const title of COLUMN_TITLES) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
  });

  it("exposes draggable cards with dnd-kit accessible wiring", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, state: "open", title: "Fix login" }));

    renderBoard();

    await waitFor(() => expect(screen.getByText("Fix login")).toBeInTheDocument());

    const card = screen.getByText("Fix login").closest("li") as HTMLElement;
    expect(card).toHaveAttribute("aria-roledescription", "draggable");
  });
});
