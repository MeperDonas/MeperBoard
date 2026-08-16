import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubItemRepo } from "../data/repositories";
import { createTestQueryClient, makeGithubItem, queryWrapper, resetDb } from "./test-utils";
import { useBoard } from "./useBoard";

describe("useBoard", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
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
    expect(board.columns[3].cards).toHaveLength(1);
  });

  it("returns empty columns with no error when the store is empty", async () => {
    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const board = result.current.data!;
    expect(board.columns).toHaveLength(6);
    expect(board.columns.every((c) => c.cards.length === 0)).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when reading the store fails", async () => {
    vi.spyOn(githubItemRepo, "getAll").mockRejectedValueOnce(new Error("indexeddb down"));

    const { result } = renderHook(() => useBoard(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
