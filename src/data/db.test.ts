import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";

describe("Dexie schema", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it("defines all six object stores", () => {
    const names = db.tables.map((table) => table.name).sort();
    expect(names).toEqual([
      "column_overrides",
      "columns",
      "epics",
      "github_items",
      "local_items",
      "repos",
    ]);
  });

  it("keys github_items by the compound {repo,number} primary key", () => {
    const primKey = db.github_items.schema.primKey;
    expect(primKey.compound).toBe(true);
    expect(primKey.keyPath).toEqual(["repo", "number"]);
  });

  it("keys column_overrides by the compound {repo,number} primary key", () => {
    expect(db.column_overrides.schema.primKey.keyPath).toEqual(["repo", "number"]);
  });

  it("uses an id primary key on repos, local_items, columns, and epics", () => {
    for (const table of [db.repos, db.local_items, db.columns, db.epics]) {
      expect(table.schema.primKey.keyPath).toBe("id");
    }
  });

  it("indexes github_items by repo, kind, and state for board/backlog queries", () => {
    const names = db.github_items.schema.indexes.map((index) => index.name);
    expect(names).toEqual(expect.arrayContaining(["repo", "kind", "state"]));
  });

  it("indexes local_items by column_id and epic_id", () => {
    const names = db.local_items.schema.indexes.map((index) => index.name);
    expect(names).toEqual(expect.arrayContaining(["column_id", "epic_id"]));
  });
});
