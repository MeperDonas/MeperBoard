/**
 * MeperBoard data layer types.
 *
 * These interfaces mirror the MeperBoard design data model (IndexedDB via
 * Dexie). Field names use snake_case to stay 1:1 with the design and with the
 * GitHub REST API payloads that `github_items` mirrors (e.g. `html_url`,
 * `updated_at`).
 */

/** Stable identifier for a mirrored GitHub repository (e.g. "owner/name"). */
export type RepoId = string;

/** The two GitHub object kinds we import into the read-only mirror. */
export type GithubItemKind = "issue" | "pull";

/** A mirrored GitHub repository. */
export interface Repo {
  id: RepoId;
  owner: string;
  name: string;
  last_sync_at: string | null;
  /** True only for the repository currently selected as the active board source. */
  is_active?: boolean;
}

/**
 * A read-only mirror of a GitHub issue or pull request.
 *
 * Primary key is the compound `{repo,number}` — re-syncing the same issue/PR
 * updates it in place rather than duplicating it.
 */
export interface GithubItem {
  repo: RepoId;
  number: number;
  kind: GithubItemKind;
  title: string;
  body: string;
  state: string;
  labels: string[];
  html_url: string;
  linked_prs: number[];
  github_updated_at: string;
  synced_at: string;
  /** Resolved column; `null` means "derive from the column strategy". */
  column_id: string | null;
}

/** A fully local, user-created card. GitHub sync never touches these. */
export interface LocalItem {
  id: string;
  title: string;
  body: string;
  labels: string[];
  column_id: string;
  position: number;
  epic_id: string | null;
  created_at: string;
}

/** A kanban column. `id` is the ColumnId referenced by cards and overrides. */
export interface Column {
  id: string;
  key: string;
  title: string;
  order: number;
  strategy: string;
}

/** An epic used to group slices into a parent/child hierarchy. */
export interface Epic {
  id: string;
  title: string;
  parent_id: string | null;
}

/**
 * A local move of a GitHub item onto a column. Stored separately from the
 * item so a re-sync never clobbers the user's manual column choice.
 */
export interface ColumnOverride {
  repo: RepoId;
  number: number;
  column_id: string;
}
