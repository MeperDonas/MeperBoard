/**
 * Backlog grouping: pure functions that turn a sorted card list into ordered
 * groups with labels and counts. Deliberately structural (no imports from the
 * state layer) so the domain stays dependency-free and trivially testable.
 *
 * Group order is fixed per key (e.g. issues before PRs, open before closed);
 * within a group, input order is preserved — callers sort before grouping.
 */

/** The group-by dimensions offered by the backlog UI. */
export type BacklogGroupKey = "none" | "column" | "state" | "type" | "source";

export interface BacklogGroupable {
  type: string;
  source: string;
  state: string | null;
  columnId?: string;
}

export interface BacklogGroup {
  /** Stable identity for keys/aria (the raw dimension value). */
  key: string;
  /** Human label rendered in the sticky header. */
  label: string;
  cards: Array<BacklogGroupable>;
}

/** A grouped bucket preserving the caller's card type. */
export interface CardGroup<T extends BacklogGroupable = BacklogGroupable> {
  key: string;
  label: string;
  cards: T[];
}

const TYPE_ORDER = ["issue", "pull", "local"] as const;
const TYPE_LABEL: Record<string, string> = {
  issue: "Issues",
  pull: "Pull requests",
  local: "Local",
};

const SOURCE_ORDER = ["github", "local"] as const;

/** Fixed state ordering; unknown states keep first-seen order after these. */
const STATE_ORDER = ["open", "closed"] as const;

const COLUMN_ORDER = ["backlog", "todo", "in-progress", "in-review", "done"] as const;
const COLUMN_LABEL: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  doing: "In Progress",
  "in-review": "In Review",
  draft: "In Progress",
  done: "Done",
};

function labelFor(kind: "type" | "state" | "source" | "column", value: string): string {
  if (kind === "type") return TYPE_LABEL[value] ?? value;
  if (kind === "column") return COLUMN_LABEL[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Group cards by the given key. `none` yields a single unlabeled group whose
 * header is never rendered by the UI. Unknown values (custom states, future
 * sources) are preserved rather than dropped.
 */
export function groupCards<T extends BacklogGroupable>(
  cards: readonly T[],
  groupBy: BacklogGroupKey,
): Array<CardGroup<T>> {
  if (groupBy === "none") {
    return [{ key: "all", label: "", cards: [...cards] }];
  }

  const buckets = new Map<string, T[]>();
  for (const card of cards) {
    const value =
      groupBy === "type"
        ? card.type
        : groupBy === "source"
          ? card.source
          : groupBy === "column"
            ? card.columnId ?? "unknown"
            : card.state ?? "";
    const bucket = buckets.get(value);
    if (bucket) bucket.push(card);
    else buckets.set(value, [card]);
  }

  // Fixed prefix order first, then any unseen values in first-seen order.
  const preferred =
    groupBy === "type"
      ? TYPE_ORDER
      : groupBy === "source"
        ? SOURCE_ORDER
        : groupBy === "column"
          ? COLUMN_ORDER
          : STATE_ORDER;
  const seen = new Set(buckets.keys());
  const orderedKeys = [
    ...preferred.filter((value) => seen.has(value)),
    ...[...seen].filter((value) => !(preferred as readonly string[]).includes(value)),
  ];

  return orderedKeys.map((key) => ({
    key,
    label: labelFor(groupBy, key),
    cards: buckets.get(key) ?? [],
  }));
}

export type FlatBacklogEntry<T extends BacklogGroupable> =
  | { kind: "header"; id: string; label: string; count: number }
  | { kind: "row"; id: string; card: T };

/**
 * Flatten grouped cards into the render order used by the virtualized list:
 * one header entry per group followed by its rows. With `none` this is simply
 * the row list — headers are only emitted for labeled groups.
 */
export function flattenGroups<T extends BacklogGroupable>(
  groups: ReadonlyArray<CardGroup<T>>,
): Array<FlatBacklogEntry<T>> {
  const entries: Array<FlatBacklogEntry<T>> = [];
  for (const group of groups) {
    if (group.label !== "") {
      entries.push({ kind: "header", id: `header:${group.key}`, label: group.label, count: group.cards.length });
    }
    for (const card of group.cards) {
      entries.push({ kind: "row", id: `row:${cardKey(card)}`, card });
    }
  }
  return entries;
}

/** Stable per-card key; falls back to index-free title+type when ids absent. */
function cardKey(card: BacklogGroupable): string {
  const withId = card as BacklogGroupable & { id?: string };
  if (typeof withId.id === "string" && withId.id !== "") return withId.id;
  return `${card.type}:${card.source}:${card.state ?? ""}`;
}
