import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children?: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

import { githubItemRepo } from "../../data/repositories";
import {
  createTestQueryClient,
  makeGithubItem,
  queryWrapper,
  resetDb,
} from "../../state/test-utils";
import { BacklogPage } from "./backlog-page";
import { IssuePage } from "./issue-page";

describe("BacklogPage", () => {
  beforeEach(resetDb);

  it("renders the backlog with the app header", async () => {
    const client = createTestQueryClient();
    render(<BacklogPage />, { wrapper: queryWrapper(client) });

    await waitFor(() => expect(screen.getByRole("region", { name: "Backlog" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "MeperBoard" })).toHaveAttribute("href", "/");
  });
});

describe("IssuePage", () => {
  beforeEach(resetDb);

  it("renders the issue detail for the selected number", async () => {
    await githubItemRepo.upsert(
      makeGithubItem({
        repo: "MeperDonas/MeperPOS",
        number: 8,
        title: "Expenses slice 1",
        body: "details",
      }),
    );

    const client = createTestQueryClient();
    render(<IssuePage number={8} />, { wrapper: queryWrapper(client) });

    await waitFor(() => expect(screen.getByRole("heading", { name: "Expenses slice 1" })).toBeInTheDocument());
    expect(screen.getByText("details")).toBeInTheDocument();
  });

  it("shows the not-found placeholder for an unknown number", async () => {
    const client = createTestQueryClient();
    render(<IssuePage number={999} />, { wrapper: queryWrapper(client) });

    await waitFor(() => expect(screen.getByText(/issue not found/i)).toBeInTheDocument());
  });
});
