import type { BacklogSort } from "../state/cards";

/**
 * Persist the backlog sort to localStorage (key: "meperboard-backlog-sort").
 *
 * Reads are validated against the known sort fields/directions so stale or
 * hand-edited storage can never poison the UI. Every accessor is guarded for
 * SSR (no `window`) and privacy modes that throw on storage access.
 */

export const BACKLOG_SORT_STORAGE_KEY = "meperboard-backlog-sort";

const SORT_FIELDS = new Set(["title", "created", "updated"]);
const SORT_DIRECTIONS = new Set(["asc", "desc"]);

/** Load the stored sort, or `null` when absent/invalid/unavailable. */
export function loadStoredBacklogSort(): BacklogSort | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BACKLOG_SORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { field, direction } = parsed as Record<string, unknown>;
    if (typeof field !== "string" || !SORT_FIELDS.has(field)) return null;
    if (direction !== undefined && (typeof direction !== "string" || !SORT_DIRECTIONS.has(direction))) {
      return null;
    }
    return { field: field as BacklogSort["field"], direction: direction as BacklogSort["direction"] };
  } catch {
    return null;
  }
}

/** Persist the sort; failures (quota, privacy mode) are silently ignored. */
export function saveBacklogSort(sort: BacklogSort): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BACKLOG_SORT_STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // Storage unavailable — persistence is best-effort.
  }
}
