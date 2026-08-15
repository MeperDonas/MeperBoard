import Dexie, { type Table } from "dexie";

import type {
  Column,
  ColumnOverride,
  Epic,
  GithubItem,
  LocalItem,
  Repo,
} from "./types";

type DbTables = {
  repos: Table<Repo, string>;
  github_items: Table<GithubItem, [string, number]>;
  local_items: Table<LocalItem, string>;
  columns: Table<Column, string>;
  epics: Table<Epic, string>;
  column_overrides: Table<ColumnOverride, [string, number]>;
};

/**
 * The MeperBoard local-first store (IndexedDB via Dexie).
 *
 * `github_items` and `column_overrides` use the compound primary key
 * `[repo+number]`, which makes upserts idempotent by `{repo,number}` — a
 * re-sync updates the existing row instead of duplicating it.
 */
export const db = new Dexie("meperboard") as Dexie & DbTables;

db.version(1).stores({
  repos: "id",
  github_items: "[repo+number], repo, kind, state, synced_at",
  local_items: "id, column_id, epic_id",
  columns: "id, key",
  epics: "id, parent_id",
  column_overrides: "[repo+number], column_id",
});
