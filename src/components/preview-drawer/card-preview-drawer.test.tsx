import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardPreviewDrawer } from "./card-preview-drawer";
import type { Card } from "../../state/cards";

const mockCard: Card = {
  id: "github:meperdonas/meperboard:56",
  source: "github",
  type: "issue",
  title: "Add awesome preview feature",
  body: "This is a detailed markdown description of the issue.",
  labels: ["feature", "frontend"],
  columnId: "in-review",
  repo: "meperdonas/meperboard",
  number: 56,
  state: "open",
  htmlUrl: "https://github.com/meperdonas/meperboard/issues/56",
  linkedPrs: [57, 58],
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-22T00:00:00Z",
};

describe("CardPreviewDrawer", () => {
  it("renders nothing when card is null", () => {
    const { container } = render(<CardPreviewDrawer card={null} onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it("renders card title, #number, state, labels, and linked PRs", () => {
    render(<CardPreviewDrawer card={mockCard} onClose={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Add awesome preview feature")).toBeInTheDocument();
    expect(screen.getByText("#56")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("feature")).toBeInTheDocument();
    expect(screen.getByText("frontend")).toBeInTheDocument();
    expect(screen.getByText(/This is a detailed markdown description/)).toBeInTheDocument();
    expect(screen.getByText("#57")).toBeInTheDocument();
    expect(screen.getByText("#58")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(<CardPreviewDrawer card={mockCard} onClose={handleClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close preview (Esc)" }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const handleClose = vi.fn();
    render(<CardPreviewDrawer card={mockCard} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("copies reference to clipboard when Copy is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CardPreviewDrawer card={mockCard} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy reference" }));

    expect(writeTextMock).toHaveBeenCalledWith("#56 Add awesome preview feature");
  });

  it("shows manual override indicator and calls onResetToGit when clicked", () => {
    const handleReset = vi.fn();
    const overriddenCard: Card = {
      ...mockCard,
      naturalColumnId: "backlog",
      isManualOverride: true,
    };

    render(
      <CardPreviewDrawer
        card={overriddenCard}
        onClose={vi.fn()}
        onResetToGit={handleReset}
      />,
    );

    expect(screen.getByText("Manual Override")).toBeInTheDocument();
    expect(screen.getByText(/Git default:/)).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /Reset to Git status/i });
    expect(resetButton).toBeInTheDocument();
    fireEvent.click(resetButton);

    expect(handleReset).toHaveBeenCalledWith(overriddenCard.id);
  });
});
