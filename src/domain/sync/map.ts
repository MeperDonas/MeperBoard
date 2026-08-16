import type { GithubItem, RepoId } from "../../data/types";

/**
 * A raw GitHub REST API issue/PR object as returned by
 * `GET /repos/{owner}/{repo}/issues?state=all`.
 *
 * That endpoint returns both issues and pull requests; a PR is identifiable by
 * the presence of its `pull_request` field. Field types are loosened (`string |
 * null`) because GitHub omits empty fields rather than always sending strings.
 */
export interface RawGithubIssue {
  number: number;
  title: string | null;
  body: string | null;
  state: string | null;
  html_url: string | null;
  updated_at: string | null;
  labels?: Array<string | { name?: string }>;
  /** Present (and truthy) only when the item is a pull request. */
  pull_request?: unknown;
}

/**
 * Map a raw GitHub issue/PR payload to a read-only `GithubItem` mirror record.
 *
 * Pure: no I/O, no database access. `linked_prs` is seeded empty here — the
 * cross-reference heuristic ("Closes #N" in PR bodies) is deferred to a later
 * work unit; it needs the full dataset, not a single payload.
 */
export function mapIssue(repo: RepoId, raw: RawGithubIssue, syncedAt: string): GithubItem {
  return {
    repo,
    number: raw.number,
    kind: raw.pull_request ? "pull" : "issue",
    title: raw.title ?? "",
    body: raw.body ?? "",
    state: raw.state ?? "open",
    labels: (raw.labels ?? [])
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter((name) => name.length > 0),
    html_url: raw.html_url ?? "",
    linked_prs: [],
    github_updated_at: raw.updated_at ?? "",
    synced_at: syncedAt,
    column_id: null,
  };
}
