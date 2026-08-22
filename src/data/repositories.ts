import { db } from "./db";
import type { Column, ColumnOverride, Epic, GithubItem, LocalItem, Repo, RepoId } from "./types";

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

  /** All mirrored items for a single repo (`where("repo").equals(repo)`, using
   * the `repo` index declared in the schema). This is the read-path filter that
   * keeps board/backlog scoped to the active repo. */
  getAllByRepo(repo: RepoId): Promise<GithubItem[]> {
    return db.github_items.where("repo").equals(repo).toArray();
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

/**
 * Repository for the `repos` table (the declared-but-unused store of known
 * repositories and, since the RepoSwitcher, the single active repo).
 *
 * The active repo is tracked with an `is_active` flag on the row keyed by its
 * `id` (the `owner/name` RepoId). `setActive` clears every other row's flag so
 * exactly one repo is active at a time. Repo ids stay coherent with
 * `github_items.repo` (`owner/name`).
 */
export const repoRepo = {
  /** Upsert a known repository (idempotent by `owner/name` id). */
  async upsert(repo: Repo): Promise<void> {
    await db.repos.put(repo);
  },

  /** Mark one repo active; every other repo row loses its active flag. */
  async setActive(owner: string, name: string): Promise<Repo> {
    await db.repos.filter((repo) => repo.is_active === true).modify({ is_active: false });
    const repo: Repo = { id: `${owner}/${name}`, owner, name, last_sync_at: null, is_active: true };
    await db.repos.put(repo);
    return repo;
  },

  /** The currently active repo, or `undefined` when none has been selected. */
  getActive(): Promise<Repo | undefined> {
    return db.repos.filter((repo) => repo.is_active === true).first();
  },

  /** All known repos. */
  listAll(): Promise<Repo[]> {
    return db.repos.toArray();
  },
};
