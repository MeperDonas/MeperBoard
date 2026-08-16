import { db } from "./db";
import type { Column, ColumnOverride, Epic, GithubItem, LocalItem, RepoId } from "./types";

/**
 * Repository for the read-only `github_items` mirror and its `column_overrides`.
 *
 * Upserts are keyed by `{repo,number}` (Dexie compound primary key), so
 * re-syncing the same issue/PR updates it in place instead of duplicating it.
 */
export const githubItemRepo = {
  async upsert(item: GithubItem): Promise<void> {
    await db.github_items.put(item);
  },

  async bulkUpsert(items: GithubItem[]): Promise<void> {
    await db.github_items.bulkPut(items);
  },

  get(repo: RepoId, number: number): Promise<GithubItem | undefined> {
    return db.github_items.get([repo, number]);
  },

  getAll(): Promise<GithubItem[]> {
    return db.github_items.toArray();
  },

  async setColumnOverride(repo: RepoId, number: number, column_id: string): Promise<void> {
    await db.column_overrides.put({ repo, number, column_id });
  },

  async clearColumnOverride(repo: RepoId, number: number): Promise<void> {
    await db.column_overrides.delete([repo, number]);
  },

  async getColumnOverride(repo: RepoId, number: number): Promise<string | undefined> {
    const override = await db.column_overrides.get([repo, number]);
    return override?.column_id;
  },

  getAllOverrides(): Promise<ColumnOverride[]> {
    return db.column_overrides.toArray();
  },
};

/** Repository for fully editable, local-only cards. */
export const localItemRepo = {
  async upsert(item: LocalItem): Promise<void> {
    await db.local_items.put(item);
  },

  async delete(id: string): Promise<void> {
    await db.local_items.delete(id);
  },

  get(id: string): Promise<LocalItem | undefined> {
    return db.local_items.get(id);
  },

  getAll(): Promise<LocalItem[]> {
    return db.local_items.toArray();
  },
};

/** Repository for kanban columns. */
export const columnRepo = {
  async upsert(column: Column): Promise<void> {
    await db.columns.put(column);
  },

  async bulkUpsert(columns: Column[]): Promise<void> {
    await db.columns.bulkPut(columns);
  },

  get(id: string): Promise<Column | undefined> {
    return db.columns.get(id);
  },

  getAll(): Promise<Column[]> {
    return db.columns.toArray();
  },
};

/** Repository for epics (slice hierarchy). */
export const epicRepo = {
  async upsert(epic: Epic): Promise<void> {
    await db.epics.put(epic);
  },

  get(id: string): Promise<Epic | undefined> {
    return db.epics.get(id);
  },

  getAll(): Promise<Epic[]> {
    return db.epics.toArray();
  },
};
