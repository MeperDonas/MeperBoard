import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { githubItemRepo } from "../data/repositories";
import { createTestQueryClient, makeGithubItem, queryWrapper, resetDb } from "./test-utils";
import { useIssueDetail } from "./useIssueDetail";

describe("useIssueDetail", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
  });

  it("stays disabled until a repo and number are selected", () => {
    const { result } = renderHook(() => useIssueDetail(undefined, undefined), {
      wrapper: queryWrapper(client),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
  });

  it("loads the selected issue on success", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 7, title: "Fix auth", body: "details" }));

    const { result } = renderHook(() => useIssueDetail("meperdonas/meperboard", 7), {
      wrapper: queryWrapper(client),
    });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ number: 7, title: "Fix auth", body: "details" });
  });

  it("returns null for a missing issue without error", async () => {
    const { result } = renderHook(() => useIssueDetail("meperdonas/meperboard", 999), {
      wrapper: queryWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("surfaces an error when the read fails", async () => {
    vi.spyOn(githubItemRepo, "get").mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useIssueDetail("meperdonas/meperboard", 7), {
      wrapper: queryWrapper(client),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
