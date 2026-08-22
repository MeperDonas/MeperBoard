/**
 * UX round 2 tuning constants. Kept in one place so density/perf knobs are
 * discoverable and unit-testable instead of scattered across components.
 */

/** A column holding more cards than this shows a warning WIP pill. */
export const MAX_WIP_PER_COLUMN = 8;

/** Delay before the backlog title-search query feeds the pipeline (ms). */
export const SEARCH_DEBOUNCE_MS = 150;
