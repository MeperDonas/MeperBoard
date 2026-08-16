import type { GithubItem, RepoId } from "../../data/types";
import { mapIssue, type RawGithubIssue } from "./map";
import { isRateLimitedStatus, RateLimiter } from "./rate-limiter";

/**
 * The read-only sync connector layer.
 *
 * `SourceConnector<T>` is the generic pipeline every future source implements:
 * fetch raw items → map each to a domain item → upsert idempotently. The
 * `GitHubConnector` is the first (MeperPOS/MeperBoard) adapter: it reads the
 * issues endpoint (which also returns PRs) and mirrors them into the
 * read-only `github_items` store. It never writes to GitHub.
 */

export interface SyncResult {
  /** Number of items imported in this sync pass. */
  imported: number;
  /** True when the sync was paused because of a rate limit. */
  paused: boolean;
}

/** Generic one-way import pipeline for a source. */
export interface SourceConnector<T> {
  /** Stable connector identifier (matches the source of the store). */
  readonly key: string;
  /** Fetch all raw items from the upstream source. */
  fetchItems(): Promise<unknown[]>;
  /** Map one raw upstream payload to the domain item. */
  mapItem(raw: unknown): T;
  /** Persist mapped items idempotently. */
  upsert(items: T[]): Promise<void>;
}

/** Minimal store surface the connector needs (satisfied by `githubItemRepo`). */
export interface GithubItemStore {
  bulkUpsert(items: GithubItem[]): Promise<void>;
}

export interface GithubConnectorDeps {
  owner: string;
  name: string;
  /** Injected HTTP fetcher (the real `fetch`, or a stub in tests). */
  fetcher: (url: string) => Promise<Response>;
  /** Injected store (the real `githubItemRepo`, or a stub in tests). */
  store: GithubItemStore;
  rateLimiter?: RateLimiter;
  now?: () => string;
}

/** GitHub adapter: fetch issues+pulls → mapIssue → upsert by {repo,number}. */
export class GitHubConnector implements SourceConnector<GithubItem> {
  readonly key = "github";

  private readonly repoId: RepoId;
  private readonly rateLimiter: RateLimiter;
  private readonly now: () => string;

  constructor(private readonly deps: GithubConnectorDeps) {
    this.repoId = `${deps.owner}/${deps.name}`;
    this.rateLimiter = deps.rateLimiter ?? new RateLimiter();
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async fetchItems(): Promise<unknown[]> {
    const collected: unknown[] = [];
    let url: string | null = this.issuesUrl();

    while (url != null) {
      const response = await this.requestWithRetry(url);

      // Rate limiter paused the sync — stop fetching and surface it upstream.
      if (this.rateLimiter.paused) break;

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const page = (await response.json()) as unknown[];
      collected.push(...page);

      this.rateLimiter.observe(response.headers);
      url = parseNextLink(response.headers.get("link"));
    }

    return collected;
  }

  mapItem(raw: unknown): GithubItem {
    return mapIssue(this.repoId, raw as RawGithubIssue, this.now());
  }

  async upsert(items: GithubItem[]): Promise<void> {
    if (items.length > 0) {
      await this.deps.store.bulkUpsert(items);
    }
  }

  /** Full pipeline: fetch → map → upsert. Failures leave prior data intact. */
  async sync(): Promise<SyncResult> {
    const rawItems = await this.fetchItems();
    const items = rawItems.map((raw) => this.mapItem(raw));
    await this.upsert(items);
    return { imported: items.length, paused: this.rateLimiter.paused };
  }

  private issuesUrl(): string {
    return `https://api.github.com/repos/${this.deps.owner}/${this.deps.name}/issues?state=all&per_page=100`;
  }

  private async requestWithRetry(url: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const response = await this.deps.fetcher(url);
      if (!isRateLimitedStatus(response.status)) return response;

      const outcome = await this.rateLimiter.handleRateLimited(response.headers, attempt);
      if (outcome === "paused") return response;
    }
  }
}

/** Extract the `rel="next"` URL from a GitHub pagination `Link` header. */
export function parseNextLink(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(",")) {
    if (!part.includes('rel="next"')) continue;
    const match = /<([^>]+)>/.exec(part);
    if (match) return match[1];
  }
  return null;
}
