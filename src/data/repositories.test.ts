import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { columnRepo, epicRepo, githubItemRepo, localItemRepo, repoRepo } from "./repositories";
import type { GithubItem, LocalItem } from "./types";

function githubItem(overrides: Partial<GithubItem> = {}): GithubItem {
  return {
    repo: "meperdonas/meperboard",
    number: 1,
    kind: "issue",
    title: "Add login",
    body: "",
    state: "open",
    labels: [],
    html_url: "https://github.com/meperdonas/meperboard/issues/1",
    linked_prs: [],
    github_updated_at: "2026-08-01T00:00:00Z",
    synced_at: "2026-08-15T00:00:00Z",
    column_id: null,
    ...overrides,
  };
}

function localItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    id: "l1",
    title: "Buy milk",
    body: "",
    labels: [],
    column_id: "todo",
    position: 0,
    epic_id: null,
    created_at: "2026-08-15T00:00:00Z",
    ...overrides,
  };
}

describe("githubItemRepo", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("upserts idempotently by {repo,number}", async () => {
    await githubItemRepo.upsert(githubItem({ number: 1, title: "Original", state: "open" }));
    await githubItemRepo.upsert(githubItem({ number: 1, title: "Renamed", state: "closed" }));

    const all = await githubItemRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      repo: "meperdonas/meperboard",
      number: 1,
      title: "Renamed",
      state: "closed",
    });
  });

  it("treats a different number or repo as a distinct row", async () => {
    await githubItemRepo.upsert(githubItem({ number: 1 }));
    await githubItemRepo.upsert(githubItem({ number: 2 }));
    await githubItemRepo.upsert(githubItem({ repo: "other/repo", number: 1 }));

    expect(await githubItemRepo.getAll()).toHaveLength(3);
  });

  it("bulkUpsert is idempotent across re-syncs", async () => {
    await githubItemRepo.bulkUpsert([githubItem({ number: 1 }), githubItem({ number: 2 })]);
    await githubItemRepo.bulkUpsert([
      githubItem({ number: 1, title: "Updated" }),
      githubItem({ number: 3 }),
    ]);

    expect(await githubItemRepo.getAll()).toHaveLength(3);
  });

  it("persists and clears a column override without clobbering the item", async () => {
    await githubItemRepo.upsert(githubItem({ number: 7 }));

    await githubItemRepo.setColumnOverride("meperdonas/meperboard", 7, "done");
    expect(await githubItemRepo.getColumnOverride("meperdonas/meperboard", 7)).toBe("done");
    expect(await db.github_items.get(["meperdonas/meperboard", 7])).toBeDefined();

    await githubItemRepo.setColumnOverride("meperdonas/meperboard", 7, "backlog");
    expect(await githubItemRepo.getColumnOverride("meperdonas/meperboard", 7)).toBe("backlog");

    await githubItemRepo.clearColumnOverride("meperdonas/meperboard", 7);
    expect(await githubItemRepo.getColumnOverride("meperdonas/meperboard", 7)).toBeUndefined();
  });

  it("getAllByRepo returns only items for the given repo", async () => {
    await githubItemRepo.upsert(githubItem({ repo: "meperdonas/meperboard", number: 1 }));
    await githubItemRepo.upsert(githubItem({ repo: "meperdonas/meperboard", number: 2 }));
    await githubItemRepo.upsert(githubItem({ repo: "acme/widgets", number: 1 }));

    const meperboard = await githubItemRepo.getAllByRepo("meperdonas/meperboard");
    expect(meperboard).toHaveLength(2);
    expect(meperboard.every((item) => item.repo === "meperdonas/meperboard")).toBe(true);

    expect(await githubItemRepo.getAllByRepo("acme/widgets")).toHaveLength(1);
    expect(await githubItemRepo.getAllByRepo("nonexistent/repo")).toHaveLength(0);
  });
});

describe("localItemRepo", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("upserts idempotently by id", async () => {
    await localItemRepo.upsert(localItem({ title: "A", column_id: "todo" }));
    await localItemRepo.upsert(localItem({ title: "A v2", column_id: "doing" }));

    const all = await localItemRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "l1", title: "A v2", column_id: "doing" });
  });
});

describe("columnRepo", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("upserts idempotently by id", async () => {
    await columnRepo.upsert({
      id: "backlog",
      key: "backlog",
      title: "Backlog",
      order: 0,
      strategy: "github-state",
    });
    await columnRepo.upsert({
      id: "backlog",
      key: "backlog",
      title: "Backlog (renamed)",
      order: 0,
      strategy: "github-state",
    });

    const all = await columnRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Backlog (renamed)");
  });
});

describe("epicRepo", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("upserts idempotently by id", async () => {
    await epicRepo.upsert({ id: "e1", title: "Expenses", parent_id: null });
    await epicRepo.upsert({ id: "e1", title: "Expenses 2026", parent_id: null });

    const all = await epicRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Expenses 2026");
  });
});

describe("repoRepo", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("upserts a known repo idempotently by id", async () => {
    await repoRepo.upsert({ id: "meperdonas/meperboard", owner: "meperdonas", name: "meperboard", last_sync_at: null });
    await repoRepo.upsert({ id: "meperdonas/meperboard", owner: "meperdonas", name: "meperboard", last_sync_at: "2026-08-01T00:00:00Z" });

    const all = await repoRepo.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: "meperdonas/meperboard", last_sync_at: "2026-08-01T00:00:00Z" });
  });

  it("persists a single active repo and returns it", async () => {
    await repoRepo.setActive("meperdonas", "meperboard");

    const active = await repoRepo.getActive();
    expect(active).toMatchObject({ owner: "meperdonas", name: "meperboard" });
  });

  it("switching the active repo replaces the previous active flag", async () => {
    await repoRepo.setActive("meperdonas", "meperboard");
    await repoRepo.setActive("acme", "widgets");

    const active = await repoRepo.getActive();
    expect(active).toMatchObject({ owner: "acme", name: "widgets" });

    // The previously active repo is now a plain known repo, no longer active.
    const all = await repoRepo.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((repo) => repo.id).sort()).toEqual(["acme/widgets", "meperdonas/meperboard"]);
  });

  it("returns undefined for getActive when no repo was marked", async () => {
    expect(await repoRepo.getActive()).toBeUndefined();
  });
});
