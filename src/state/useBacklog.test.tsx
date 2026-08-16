import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubItemRepo, localItemRepo } from "../data/repositories";
import {
  createTestQueryClient,
  makeGithubItem,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "./test-utils";
import { useBacklog } from "./useBacklog";

describe("useBacklog", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
  });

  it("returns the full mixed list on success", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1 }));
    await localItemRepo.upsert(makeLocalItem({ id: "l1" }));

    const { result } = renderHook(() => useBacklog(), { wrapper: queryWrapper(client) });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it("filters by type and sorts by title", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 1, title: "zeta" }));
    await githubItemRepo.upsert(makeGithubItem({ number: 2, kind: "pull", title: "alpha" }));

    const { result } = renderHook(
      () => useBacklog({ type: "pull" }, { field: "title" }),
      { wrapper: queryWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.map((c) => c.title)).toEqual(["alpha"]);
  });

  it("returns an empty list for an empty store", async () => {
    const { result } = renderHook(() => useBacklog(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it("surfaces an error when reading the store fails", async () => {
    vi.spyOn(githubItemRepo, "getAll").mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useBacklog(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
