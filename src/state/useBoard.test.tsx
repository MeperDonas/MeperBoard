import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { githubItemRepo, repoRepo } from "../data/repositories";
import { createTestQueryClient, makeGithubItem, queryWrapper, resetDb } from "./test-utils";
import { useBoard } from "./useBoard";

describe("useBoard", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    await repoRepo.setActive("meperdonas", "meperboard");
    client = createTestQueryClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads cards into ordered columns on success", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, state: "open" }));
    await githubItemRepo.upsert(makeGithubItem({ number: 2, state: "closed" }));

    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const board = result.current.data!;
    expect(board.columns[0].cards).toHaveLength(1);
    expect(board.columns[0].cards[0]).toMatchObject({ number: 1, columnId: "backlog" });
    expect(board.columns[4].cards).toHaveLength(1);
  });

  it("returns empty columns with no error when the store is empty", async () => {
    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const board = result.current.data!;
    expect(board.columns).toHaveLength(5);
    expect(board.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when reading the store fails", async () => {
    vi.spyOn(githubItemRepo, "getAllByRepos").mockRejectedValue(new Error("indexeddb down"));

    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it("shows only the active repo's cards after a repo is selected", async () => {
    await githubItemRepo.upsert(makeGithubItem({ repo: "meperdonas/meperboard", number: 1, title: "Meper" }));
    await githubItemRepo.upsert(makeGithubItem({ repo: "acme/widgets", number: 1, title: "Acme" }));
    await repoRepo.setActive("meperdonas", "meperboard");

    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const titles = result.current.data!.columns.flatMap((column) => column.cards.map((card) => card.title));
    expect(titles).toEqual(["Meper"]);
  });

  it("shows cards from all active repos when multiple are active", async () => {
    await githubItemRepo.upsert(makeGithubItem({ repo: "meperdonas/meperboard", number: 1, title: "Meper" }));
    await githubItemRepo.upsert(makeGithubItem({ repo: "acme/widgets", number: 1, title: "Acme" }));
    await githubItemRepo.upsert(makeGithubItem({ repo: "other/repo", number: 1, title: "Other" }));
    // meperdonas/meperboard was set active in beforeEach; now activate acme/widgets as well
    await repoRepo.toggleActive("acme", "widgets");

    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const titles = result.current.data!.columns.flatMap((column) => column.cards.map((card) => card.title));
    expect(titles.sort()).toEqual(["Acme", "Meper"]);
  });
});
