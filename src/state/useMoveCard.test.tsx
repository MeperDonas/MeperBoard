import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { githubItemRepo, localItemRepo } from "../data/repositories";
import {
  createTestQueryClient,
  makeGithubItem,
  makeLocalItem,
  queryWrapper,
  resetDb,
} from "./test-utils";
import { useMoveCard } from "./useMoveCard";

describe("useMoveCard", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
  });

  it("persists a local move and invalidates the board", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", column_id: "todo" }));

    const { result } = renderHook(() => useMoveCard(), { wrapper: queryWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ cardId: "local:l1", toColumnId: "doing" });
    });

    expect(await localItemRepo.get("l1")).toMatchObject({ column_id: "doing" });
  });

  it("persists a GitHub override and invalidates the board", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 3 }));

    const { result } = renderHook(() => useMoveCard(), { wrapper: queryWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({
        cardId: "github:meperdonas/meperboard:3",
        toColumnId: "in-review",
      });
    });

    expect(await githubItemRepo.getColumnOverride("meperdonas/meperboard", 3)).toBe("in-review");
  });

  it("surfaces an error for an unknown card id", async () => {
    const { result } = renderHook(() => useMoveCard(), { wrapper: queryWrapper(client) });

    await act(async () => {
      await expect(result.current.mutateAsync({ cardId: "wat:1", toColumnId: "done" })).rejects.toThrow(
        /unknown card id/i,
      );
    });
  });

  it("resolves a moved card into its new column on the next board read", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", title: "Buy milk", column_id: "todo" }));

    const { result } = renderHook(() => useMoveCard(), { wrapper: queryWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ cardId: "local:l1", toColumnId: "doing" });
    });

    const stored = await localItemRepo.getAll();
    expect(stored[0]).toMatchObject({ column_id: "doing" });
  });
});
