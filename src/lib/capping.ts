/**
 * Windowing/capping helpers for large lists (board columns + backlog
 * virtualization switch). Pure functions so the render layer stays dumb and
 * the numbers are unit-testable.
 */

/** Cards rendered per board column before a "Show more" footer appears. */
export const INITIAL_VISIBLE_CARDS = 40;

/** Additional cards revealed by each click of the "Show N more" footer. */
export const CARD_EXPAND_STEP = 100;

/**
 * List sizes at or below this threshold render as plain lists; above it, the
 * backlog switches to window virtualization. Small lists (and jsdom tests)
 * keep simple, fully-rendered markup; huge lists stop mounting every row.
 */
export const VIRTUALIZE_THRESHOLD = 80;

/** Rows visible in the virtualized backlog before overscan kicks in. */
export const BACKLOG_ROW_HEIGHT = 56;
/** Sticky group-header height inside the virtualized list. */
export const BACKLOG_HEADER_HEIGHT = 40;
/** Extra rows rendered beyond the visible viewport while virtualizing. */
export const BACKLOG_OVERSCAN = 8;

/** Clamp a negative or fractional step count into valid range. */
function clampSteps(expandSteps: number): number {
  if (!Number.isFinite(expandSteps) || expandSteps < 0) return 0;
  return Math.floor(expandSteps);
}

/** How many cards a column should currently render. */
export function visibleCardCount(total: number, expandSteps: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(total, INITIAL_VISIBLE_CARDS + clampSteps(expandSteps) * CARD_EXPAND_STEP);
}

/** How many cards remain hidden behind the "Show N more" footer. */
export function remainingCardCount(total: number, expandSteps: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  return total - visibleCardCount(total, expandSteps);
}

export function shouldVirtualize(count: number): boolean {
  return Number.isFinite(count) && count > VIRTUALIZE_THRESHOLD;
}
