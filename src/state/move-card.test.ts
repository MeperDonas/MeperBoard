import { beforeEach, describe, expect, it } from "vitest";

import { githubItemRepo, localItemRepo } from "../data/repositories";
import { makeGithubItem, makeLocalItem, resetDb } from "./test-utils";
import { parseGithubCardId, parseLocalCardId, persistCardMove } from "./move-card";

describe("parseLocalCardId", () => {
  it("extracts the local id from a local card id", () => {
    expect(parseLocalCardId("local:l1")).toBe("l1");
  });

  it("returns null for a GitHub card id", () => {
    expect(parseLocalCardId("github:meperdonas/meperpos:3")).toBeNull();
  });

  it("returns null for a bare local id", () => {
    expect(parseLocalCardId("l1")).toBeNull();
  });
});

describe("parseGithubCardId", () => {
  it("extracts repo and number from a github card id", () => {
    expect(parseGithubCardId("github:meperdonas/meperpos:3")).toEqual({
      repo: "meperdonas/meperpos",
      number: 3,
    });
  });

  it("returns null for a local card id", () => {
    expect(parseGithubCardId("local:l1")).toBeNull();
  });

  it("returns null for malformed github card ids", () => {
    expect(parseGithubCardId("github:nocolon")).toBeNull();
    expect(parseGithubCardId("github:repo:notanumber")).toBeNull();
  });
});

describe("persistCardMove", () => {
  beforeEach(resetDb);

  it("updates a local card's column in place", async () => {
    await localItemRepo.upsert(makeLocalItem({ id: "l1", column_id: "todo" }));

    await persistCardMove({ cardId: "local:l1", toColumnId: "doing" });

    expect(await localItemRepo.get("l1")).toMatchObject({ column_id: "doing" });
  });

  it("writes a column override for a GitHub card", async () => {
    await githubItemRepo.upsert(makeGithubItem({ number: 3, state: "open" }));

    await persistCardMove({ cardId: "github:meperdonas/meperboard:3", toColumnId: "done" });

    expect(await githubItemRepo.getColumnOverride("meperdonas/meperboard", 3)).toBe("done");
  });

  it("rejects an unknown card id", async () => {
    await expect(persistCardMove({ cardId: "wat:1", toColumnId: "done" })).rejects.toThrow(
      /unknown card id/i,
    );
  });

  it("rejects a move for a missing local card", async () => {
    await expect(persistCardMove({ cardId: "local:missing", toColumnId: "done" })).rejects.toThrow(
      /not found/i,
    );
  });
});
