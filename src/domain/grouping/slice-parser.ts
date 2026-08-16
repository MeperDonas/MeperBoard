/**
 * "X slice N" title heuristic.
 *
 * Parses titles like "Expenses slice 3" and "Expenses module - slice 3: desc"
 * into an epic name ("Expenses") and a 1-based slice number (3). The optional
 * "module -" separator is consumed so the epic name stays clean. The pattern is
 * not end-anchored, so a trailing description after the slice number is fine.
 * Case-insensitive. Titles without the pattern return `null` so they stay
 * top-level and ungrouped.
 */

/** A parsed slice title. */
export interface SliceMatch {
  /** Epic name — the text before "slice N". */
  epic: string;
  /** 1-based slice number. */
  slice: number;
}

const SLICE_PATTERN = /^(.+?)\s+(?:module\s*[-–—]\s*)?slice\s+(\d+)\b/i;

/**
 * Parse a title using the "X slice N" heuristic.
 *
 * Returns `null` when the title does not match the pattern (including when no
 * epic name precedes "slice N", e.g. a bare "slice 3").
 */
export function parseSlice(title: string): SliceMatch | null {
  const match = SLICE_PATTERN.exec(title.trim());
  if (!match) return null;

  const epic = match[1].trim();
  const slice = Number.parseInt(match[2], 10);
  if (epic.length === 0 || !Number.isFinite(slice)) return null;

  return { epic, slice };
}
