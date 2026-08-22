/**
 * Compact relative-date formatting for dense badges ("3d", "5h", "2mo").
 *
 * Pure and deterministic: pass `nowMs` explicitly in tests; production callers
 * default to `Date.now()`. Future timestamps clamp to "now" — we never render
 * negative durations.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Days above which a duration is rendered in months (~30-day months). */
const MONTH_DAYS = 30;
/** Days above which a duration is rendered in years. */
const YEAR_DAYS = 365;

export function formatRelativeShort(iso: string, nowMs: number = Date.now()): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "";

  const elapsed = Math.max(0, nowMs - timestamp);

  if (elapsed < MINUTE_MS) return "now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;

  const days = Math.floor(elapsed / DAY_MS);
  if (days < MONTH_DAYS) return `${days}d`;
  if (days < YEAR_DAYS) return `${Math.round(days / MONTH_DAYS)}mo`;
  return `${Math.floor(days / YEAR_DAYS)}y`;
}
