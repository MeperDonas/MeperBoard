import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { localItemRepo } from "../data/repositories";
import {
  createTestQueryClient,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "./test-utils";
import { useLocalCards } from "./useLocalCards";

describe("useLocalCards", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
  });

  it("starts empty", async () => {
    const { result } = renderHook(() => useLocalCards(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    expect(result.current.list.data).toEqual([]);
  });

  it("creates a local card in the mapped column and persists it", async () => {
    const { result } = renderHook(() => useLocalCards({ idFactory: () => "l-1" }), {
      wrapper: queryWrapper(client),
    });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.create.mutateAsync({ title: "Buy milk", status: "doing" });
    });

    const stored = await localItemRepo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ id: "l-1", title: "Buy milk", column_id: "in-progress" });
  });

  it("creates a local card associated with a repository", async () => {
    const { result } = renderHook(() => useLocalCards({ idFactory: () => "l-2" }), {
      wrapper: queryWrapper(client),
    });

    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.create.mutateAsync({
        title: "Database index optimization",
        status: "todo",
        repo: "MeperDonas/MeperBoard",
      });
    });

    const stored = await localItemRepo.getAll();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: "l-2",
      title: "Database index optimization",
      column_id: "todo",
      repo: "MeperDonas/MeperBoard",
    });
  });

  it("edits an existing card in place", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Old" }));

    const { result } = renderHook(() => useLocalCards(), { wrapper: queryWrapper(client) });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.update.mutateAsync({ id: "l1", patch: { title: "New" } });
    });

    expect(await localItemRepo.get("l1")).toMatchObject({ title: "New" });
  });

  it("deletes a card", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1" }));

    const { result } = renderHook(() => useLocalCards(), { wrapper: queryWrapper(client) });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.remove.mutateAsync("l1");
    });

    expect(await localItemRepo.getAll()).toHaveLength(0);
  });

  it("surfaces a list error", async () => {
    vi.spyOn(localItemRepo, "getAll").mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useLocalCards(), { wrapper: queryWrapper(client) });

    await waitFor(() => expect(result.current.list.isError).toBe(true));
    expect(result.current.list.error).toBeInstanceOf(Error);
  });
});
