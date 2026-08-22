/**
 * Backlog pagination pipeline (UX round 3). Pure functions so the render
 * layer stays dumb and the numbers are unit-testable.
 *
 * Pipeline order is filters → search → sort → PAGINATE → group → render;
 * pagination runs BEFORE virtualization, so the current page slice is what
 * renders and the virtualizer only ever sees one page's worth of entries
 * (it still activates when a single page exceeds the threshold).
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

/** Default page size — small fixtures keep rendering as a single page. */
export const DEFAULT_PAGE_SIZE: PageSizeOption = 25;

/** The pager shows whenever the list exceeds this many items, even if a
 * larger page size would fit everything: switching sizes must stay possible. */
export const PAGER_VISIBLE_ABOVE = DEFAULT_PAGE_SIZE;

export interface Paginated<T> {
  /** The current page slice (never larger than pageSize). */
  items: T[];
  /** Effective 1-based page after clamping against totalPages. */
  page: number;
  /** Effective page size after sanitizing invalid values. */
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/** Sanitize an untrusted page size into a supported option. */
export function sanitizePageSize(pageSize: number): PageSizeOption {
  const match = PAGE_SIZE_OPTIONS.find((option) => option === pageSize);
  return match ?? DEFAULT_PAGE_SIZE;
}

/** Number of pages a list occupies under the given page size (min 1). */
export function pageCount(totalItems: number, pageSize: number): number {
  const size = sanitizePageSize(pageSize);
  if (!Number.isFinite(totalItems) || totalItems <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / size));
}

/** Clamp a 1-based requested page into [1, totalPages]. */
export function clampPage(totalItems: number, pageSize: number, requestedPage: number): number {
  const pages = pageCount(totalItems, pageSize);
  if (!Number.isFinite(requestedPage)) return 1;
  return Math.min(pages, Math.max(1, Math.floor(requestedPage)));
}

/**
 * Slice `items` into the requested page. Out-of-range or invalid pages clamp
 * instead of throwing, so a stale page index after filtering never crashes.
 */
export function paginate<T>(items: readonly T[], requestedPage: number, pageSize: number): Paginated<T> {
  const size = sanitizePageSize(pageSize);
  const totalItems = Array.isArray(items) ? items.length : 0;
  const totalPages = pageCount(totalItems, size);
  const page = clampPage(totalItems, size, requestedPage);
  const start = (page - 1) * size;
  return {
    items: items.slice(start, start + size),
    page,
    pageSize: size,
    totalItems,
    totalPages,
  };
}
