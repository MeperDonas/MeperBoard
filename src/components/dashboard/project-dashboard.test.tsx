import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Card } from "../../state/cards";
import { ProjectDashboard } from "./project-dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "github:owner/repo:1",
    source: "github",
    type: "issue",
    title: "Setup Next.js",
    body: "Body",
    labels: [],
    columnId: "backlog",
    repo: "owner/repo",
    number: 1,
    state: "open",
    htmlUrl: null,
    linkedPrs: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("ProjectDashboard", () => {
  const cards: Card[] = [
    makeCard({ id: "1", columnId: "done", state: "closed" }),
    makeCard({ id: "2", columnId: "in-progress" }),
    makeCard({ id: "3", columnId: "todo", labels: ["bug", "critical"] }),
    makeCard({ id: "4", columnId: "backlog" }),
    makeCard({ id: "5", columnId: "backlog" }),
  ];

  it("renders KPI cards and progress percentage", () => {
    render(
      <ProjectDashboard
        cards={cards}
        searchQuery=""
        onSearchChange={vi.fn()}
        filterType="all"
        onFilterTypeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "Project health dashboard" })).toBeInTheDocument();
    expect(screen.getByTestId("kpi-completed")).toHaveTextContent("1/5");
    expect(screen.getByTestId("kpi-in-progress")).toHaveTextContent("1");
    expect(screen.getByTestId("kpi-critical")).toHaveTextContent("1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByText("20%")).toBeInTheDocument();
  });

  it("updates search query when typing", () => {
    const onSearch = vi.fn();
    render(
      <ProjectDashboard
        cards={cards}
        searchQuery=""
        onSearchChange={onSearch}
        filterType="all"
        onFilterTypeChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Search issues and cards");
    fireEvent.change(input, { target: { value: "Setup" } });
    expect(onSearch).toHaveBeenCalledWith("Setup");
  });

  it("switches filter types from the filters dropdown", () => {
    const onFilter = vi.fn();
    render(
      <ProjectDashboard
        cards={cards}
        searchQuery=""
        onSearchChange={vi.fn()}
        filterType="all"
        onFilterTypeChange={onFilter}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Filter cards" }));
    fireEvent.click(screen.getByRole("button", { name: "PRs Only" }));
    expect(onFilter).toHaveBeenCalledWith("pull");
  });

  it("triggers creation on New Issue CTA click", () => {
    const onOpenCreate = vi.fn();
    render(
      <ProjectDashboard
        cards={cards}
        searchQuery=""
        onSearchChange={vi.fn()}
        filterType="all"
        onFilterTypeChange={vi.fn()}
        onOpenCreate={onOpenCreate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New card or issue" }));
    expect(onOpenCreate).toHaveBeenCalled();
  });
});
