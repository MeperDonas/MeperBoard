import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { localItemRepo } from "../../data/repositories";
import {
  createTestQueryClient,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "../../state/test-utils";
import { LocalCards } from "./local-cards";

function renderLocalCards() {
  const client = createTestQueryClient();
  const utils = render(<LocalCards />, { wrapper: queryWrapper(client) });
  return { client, ...utils };
}

/** Drive the custom popover select (round 3): open, then pick an option. */
function changeSelect(name: string, optionLabel: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  fireEvent.click(screen.getByRole("option", { name: optionLabel }));
}

/** Wait for the create form to appear (i.e. the list query has resolved). */
async function waitForForm() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add card" })).toBeInTheDocument(),
  );
}

describe("LocalCards", () => {
  beforeEach(resetDb);

  it("renders an empty state when there are no local cards", async () => {
    renderLocalCards();

    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Local cards" })).toBeInTheDocument(),
    );

    expect(screen.getByText(/no local cards yet/i)).toBeInTheDocument();
  });

  it("creates a local card in the To Do column by default", async () => {
    renderLocalCards();
    await waitForForm();

    fireEvent.change(screen.getByLabelText("New card title"), {
      target: { value: "Buy milk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add card" }));

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());

    const stored = await localItemRepo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ title: "Buy milk", column_id: "todo" });
  });

  it("creates a local card with a chosen status", async () => {
    renderLocalCards();
    await waitForForm();

    fireEvent.change(screen.getByLabelText("New card title"), {
      target: { value: "Ship v1" },
    });
    changeSelect("New card status", "Doing");
    fireEvent.click(screen.getByRole("button", { name: "Add card" }));

    await waitFor(() => expect(screen.getByText("Ship v1")).toBeInTheDocument());

    const stored = await localItemRepo.getAll();
    expect(stored[0]).toMatchObject({ title: "Ship v1", column_id: "doing" });
  });

  it("does not create a card with a blank title", async () => {
    renderLocalCards();
    await waitForForm();

    fireEvent.click(screen.getByRole("button", { name: "Add card" }));

    expect(await localItemRepo.getAll()).toHaveLength(0);
  });

  it("edits an existing card's title and status", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk", column_id: "todo" }));

    renderLocalCards();

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());

    const row = screen.getByText("Buy milk").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));

    fireEvent.change(screen.getByLabelText("Edit card title"), {
      target: { value: "Buy oat milk" },
    });
    changeSelect("Edit card status", "Done");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.getByText("Buy oat milk")).toBeInTheDocument());

    expect(await localItemRepo.get("l1")).toMatchObject({
      title: "Buy oat milk",
      column_id: "done",
    });
  });

  it("cancels an edit without changing the card", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk", column_id: "todo" }));

    renderLocalCards();

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());

    const row = screen.getByText("Buy milk").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());
    expect(await localItemRepo.get("l1")).toMatchObject({ title: "Buy milk" });
  });

  it("deletes a card", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk" }));

    renderLocalCards();

    await waitFor(() => expect(screen.getByText("Buy milk")).toBeInTheDocument());

    const row = screen.getByText("Buy milk").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Buy milk")).not.toBeInTheDocument());
    expect(await localItemRepo.getAll()).toHaveLength(0);
  });
});
