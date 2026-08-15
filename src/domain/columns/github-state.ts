import { COLUMN, type ColumnStrategy } from "./strategy";

/**
 * Minimal state view the GitHub strategy needs to resolve a column. Decoupled
 * from the full `GithubItem` data record so the domain stays self-contained;
 * the sync connector supplies these fields from the GitHub REST payload.
 */
export interface GithubItemState {
  /** Whether this item is an issue or a pull request. */
  kind: "issue" | "pull";
  /** GitHub `state` — `"open"` or `"closed"`. */
  state: string;
  /** PR draft flag (GitHub `draft`). Always `false` for issues. */
  draft?: boolean;
  /** PR merged flag (GitHub `pull_request.merged`). Always `false` for issues. */
  merged?: boolean;
}

/**
 * Default column mapping for mirrored GitHub items:
 *
 * - issue  open   → Backlog
 * - issue  closed → Done
 * - pull   open   → In Review
 * - pull   merged → Done
 * - pull   draft  → Draft
 * - pull   closed (unmerged) → Done
 */
export const githubStateStrategy: ColumnStrategy<GithubItemState> = {
  key: "github-state",

  columnFor(item) {
    if (item.kind === "pull") {
      if (item.draft) return COLUMN.draft;
      if (item.merged || item.state === "closed") return COLUMN.done;
      return COLUMN.inReview;
    }
    return item.state === "closed" ? COLUMN.done : COLUMN.backlog;
  },
};
