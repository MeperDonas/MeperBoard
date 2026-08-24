import { columnRepo, githubItemRepo, localItemRepo } from "../data/repositories";
import type { Column, GithubItem, LocalItem, RepoId } from "../data/types";
import { githubStateStrategy } from "../domain/columns";
import { DEFAULT_REPO_ID } from "./useSync";

/**
 * Unified card projection over `github_items ∪ local_items`.
 *
 * Per the design, cards are a *projection*, not a separate table — a single
 * source of truth per source. The board and backlog both read this projection;
 * the TanStack Query hooks wrap it.
 */

export type CardSource = "github" | "local";
export type CardType = "issue" | "pull" | "local";

export interface Card {
  /** Stable id across projections: `github:{repo}:{number}` or `local:{id}`. */
  id: string;
  source: CardSource;
  /** `issue`, `pull`, or `local` — the value used for type filtering. */
  type: CardType;
  title: string;
  body: string;
  labels: string[];
  /** Resolved column id (a `ColumnId` from the column strategies). */
  columnId: string;
  /** Natural upstream column mapped by GitHub state strategy before manual overrides. */
  naturalColumnId?: string;
  /** True when the card's column was manually changed away from the Git default. */
  isManualOverride?: boolean;
  repo: RepoId | null;
  number: number | null;
  state: string | null;
  htmlUrl: string | null;
  linkedPrs: number[];
  /** Sortable "created" timestamp: `synced_at` (github) or `created_at` (local). */
  createdAt: string;
  /** Sortable "updated" timestamp: `github_updated_at` or `created_at` (local). */
  updatedAt: string;
}

export function githubCardId(repo: RepoId, number: number): string {
  return `github:${repo}:${number}`;
}

export function localCardId(id: string): string {
  return `local:${id}`;
}

export function toCard(item: GithubItem | LocalItem): Card {
  return isGithubItem(item) ? githubToCard(item) : localToCard(item);
}

function isGithubItem(item: GithubItem | LocalItem): item is GithubItem {
  return "repo" in item && "number" in item;
}

function githubToCard(item: GithubItem, overrideColumn?: string): Card {
  const naturalColumnId = resolveGithubColumn(item);
  const columnId =
    item.state === "closed" && overrideColumn !== "done"
      ? "done"
      : (overrideColumn ?? naturalColumnId);

  const isManualOverride = overrideColumn != null && overrideColumn !== naturalColumnId;

  return {
    id: githubCardId(item.repo, item.number),
    source: "github",
    type: item.kind,
    title: item.title,
    body: item.body,
    labels: item.labels,
    columnId,
    naturalColumnId,
    isManualOverride,
    repo: item.repo,
    number: item.number,
    state: item.state,
    htmlUrl: item.html_url,
    linkedPrs: item.linked_prs,
    createdAt: item.synced_at,
    updatedAt: item.github_updated_at,
  };
}

function localToCard(item: LocalItem): Card {
  return {
    id: localCardId(item.id),
    source: "local",
    type: "local",
    title: item.title,
    body: item.body,
    labels: item.labels,
    columnId: item.column_id,
    naturalColumnId: item.column_id,
    isManualOverride: false,
    repo: null,
    number: null,
    state: null,
    htmlUrl: null,
    linkedPrs: [],
    createdAt: item.created_at,
    updatedAt: item.created_at,
  };
}

/**
 * Resolve a GitHub item to a column: an explicit `column_id` wins, otherwise
 * the `github-state` strategy maps `kind` + `state`. PR `draft`/`merged` flags
 * are not carried on `GithubItem` yet (they require the `/pulls` endpoint), so
 * draft PRs currently resolve to In Review — a sync-layer follow-up.
 */
export function resolveGithubColumn(item: GithubItem): string {
  if (item.column_id != null) return item.column_id;
  return githubStateStrategy.columnFor({ kind: item.kind, state: item.state });
}

/**
 * Read all cards (github + local) as a unified projection.
 *
 * GitHub items are filtered to the active repos (`activeRepoIds`), defaulting to
 * `DEFAULT_REPO_ID` when no repo has been selected. Local cards are NOT filtered
 * (they are global to the board and independent of the active repo).
 */
export async function loadCards(activeRepoIds?: RepoId[] | RepoId): Promise<Card[]> {
  const repos = Array.isArray(activeRepoIds)
    ? (activeRepoIds.length > 0 ? activeRepoIds : [DEFAULT_REPO_ID])
    : (activeRepoIds ? [activeRepoIds] : [DEFAULT_REPO_ID]);

  const [githubItems, localItems, overrides] = await Promise.all([
    githubItemRepo.getAllByRepos(repos),
    localItemRepo.getAll(),
    githubItemRepo.getAllOverrides(),
  ]);

  const overrideByKey = new Map(
    overrides.map((override) => [`${override.repo}:${override.number}`, override.column_id]),
  );

  return [
    ...githubItems.map((item) =>
      githubToCard(item, overrideByKey.get(`${item.repo}:${item.number}`)),
    ),
    ...localItems.map(toCard),
  ];
}

/** The canonical board layout, used until real columns are seeded. */
export const DEFAULT_BOARD_COLUMNS: Column[] = [
  { id: "backlog", key: "backlog", title: "Backlog", order: 0, strategy: "github-state" },
  { id: "todo", key: "todo", title: "To Do", order: 1, strategy: "local-status" },
  { id: "in-progress", key: "in-progress", title: "In Progress", order: 2, strategy: "local-status" },
  { id: "in-review", key: "in-review", title: "In Review", order: 3, strategy: "github-state" },
  { id: "done", key: "done", title: "Done", order: 4, strategy: "github-state" },
];

export interface BoardColumn extends Column {
  cards: Card[];
}

export interface Board {
  columns: BoardColumn[];
}

/** Load board columns, falling back to the canonical layout when unseeded. */
export async function loadColumns(): Promise<Column[]> {
  const stored = await columnRepo.getAll();
  if (stored.length === 0) return DEFAULT_BOARD_COLUMNS;
  return [...stored].sort((a, b) => a.order - b.order);
}

/** Full board projection: columns (ordered) + their resolved cards. */
export async function loadBoard(activeRepoIds?: RepoId[] | RepoId): Promise<Board> {
  const [columns, cards] = await Promise.all([loadColumns(), loadCards(activeRepoIds)]);
  return buildBoard(columns, cards);
}

/** Group cards into ordered columns. Cards with an unknown column are dropped. */
export function buildBoard(columns: Column[], cards: Card[]): Board {
  const byColumn = new Map<string, Card[]>();
  for (const card of cards) {
    const list = byColumn.get(card.columnId);
    if (list) list.push(card);
    else byColumn.set(card.columnId, [card]);
  }
  const ordered = [...columns].sort((a, b) => a.order - b.order);
  return {
    columns: ordered.map((col) => ({ ...col, cards: byColumn.get(col.id) ?? [] })),
  };
}

export interface BacklogFilters {
  label?: string;
  type?: CardType;
  repo?: RepoId;
}

/** Filter cards by label, type, and/or repo. Empty/undefined filters match all. */
export function filterCards(cards: Card[], filters: BacklogFilters = {}): Card[] {
  const { label, type, repo } = filters;
  return cards.filter((card) => {
    if (type != null && card.type !== type) return false;
    if (label != null && label !== "" && !card.labels.includes(label)) return false;
    if (repo != null && repo !== "" && card.repo !== repo) return false;
    return true;
  });
}

export type SortField = "updated" | "created" | "number" | "title" | "state" | "column";
export type SortDirection = "asc" | "desc";

export interface BacklogSort {
  field: SortField;
  direction?: SortDirection;
}

/** Deterministically sort cards; ties break on id so ordering is stable. */
export function sortCards(cards: Card[], sort?: BacklogSort): Card[] {
  if (!sort) return [...cards];
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...cards].sort((a, b) => compareByField(a, b, sort.field) * direction);
}

function compareByField(a: Card, b: Card, field: SortField): number {
  if (field === "number") {
    const numA = a.number ?? Infinity;
    const numB = b.number ?? Infinity;
    if (numA !== numB) return numA - numB;
  } else if (field === "state") {
    const stateA = a.state ?? "open";
    const stateB = b.state ?? "open";
    const byState = compareStrings(stateA, stateB);
    if (byState !== 0) return byState;
  } else if (field === "column") {
    const byCol = compareStrings(a.columnId, b.columnId);
    if (byCol !== 0) return byCol;
  } else if (field === "updated" || field === "created") {
    const timeA = new Date(field === "updated" ? a.updatedAt : a.createdAt).getTime() || 0;
    const timeB = new Date(field === "updated" ? b.updatedAt : b.createdAt).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
  } else {
    const byValue = compareStrings(a.title, b.title);
    if (byValue !== 0) return byValue;
  }
  return compareStrings(a.id, b.id);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
