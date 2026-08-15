/**
 * Column semantics — the pluggable strategy layer.
 *
 * A `ColumnStrategy` resolves an item to exactly one column key. The mapping is
 * a pure function: no I/O, no database access, no GitHub calls. Keeping column
 * semantics in this thin layer lets the board and sync connector swap mappings
 * without touching the data model — e.g. a future `LabelDrivenStrategy` drops in
 * here and nowhere else.
 */

/** Canonical column keys the domain resolves into. */
export const COLUMN = {
  backlog: "backlog",
  inReview: "in-review",
  draft: "draft",
  done: "done",
  todo: "todo",
  doing: "doing",
} as const;

/** A resolved column key. */
export type ColumnId = (typeof COLUMN)[keyof typeof COLUMN];

/** A pluggable mapping from an item to a single column. */
export interface ColumnStrategy<TItem = unknown> {
  /** Stable strategy identifier — matches `Column.strategy` in the data layer. */
  readonly key: string;
  /** Resolve an item to exactly one column key. Pure: no side effects. */
  columnFor(item: TItem): ColumnId;
}
