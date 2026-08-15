import { parseSlice } from "./slice-parser";

/** A known epic that slice groups can attach to. */
export interface SliceEpic {
  id: string;
  title: string;
}

/** An item eligible for slice grouping. */
export interface SliceItem {
  id: string;
  title: string;
}

/** One slice resolved into a group. */
export interface GroupedSlice {
  id: string;
  title: string;
  slice: number;
}

/** A group of slices under a single epic. */
export interface SliceGroup {
  /** Id of the matched known epic, or `null` when the epic is synthesized. */
  epicId: string | null;
  /** Canonical epic title (matched epic's title, or the parsed epic name). */
  epicTitle: string;
  slices: GroupedSlice[];
}

/** Result of aggregating items into an epic→slice hierarchy. */
export interface SliceAggregation {
  groups: SliceGroup[];
  /** Items with no slice pattern — top-level and ungrouped, never dropped. */
  ungrouped: SliceItem[];
}

/**
 * Group items into an epic→slice hierarchy.
 *
 * Rules:
 * - Items whose title matches "X slice N" are grouped by their resolved epic.
 * - A slice attaches to the most specific known epic: the longest epic title
 *   that the parsed epic name starts with (on word boundaries). No known epic →
 *   the group is synthesized under the parsed epic name.
 * - Non-slice items stay top-level in `ungrouped`.
 * - Output is deterministic: groups sorted by title, slices by number then id,
 *   and no item or group is ever duplicated.
 */
export function aggregateSlices(
  items: SliceItem[],
  epics: SliceEpic[] = [],
): SliceAggregation {
  // Longest title first, so the first prefix match is the most specific epic.
  const sortedEpics = [...epics].sort((a, b) => b.title.length - a.title.length);

  const groups = new Map<string, SliceGroup>();
  const ungrouped: SliceItem[] = [];

  for (const item of items) {
    const match = parseSlice(item.title);
    if (!match) {
      ungrouped.push(item);
      continue;
    }

    const epic = matchEpic(match.epic, sortedEpics);
    const groupKey = epic ? `epic:${epic.id}` : `synth:${normalize(match.epic)}`;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        epicId: epic ? epic.id : null,
        epicTitle: epic ? epic.title : match.epic,
        slices: [],
      };
      groups.set(groupKey, group);
    }

    // A given item belongs to exactly one group.
    if (!group.slices.some((s) => s.id === item.id)) {
      group.slices.push({ id: item.id, title: item.title, slice: match.slice });
    }
  }

  const result = [...groups.values()].sort((a, b) => compareStrings(a.epicTitle, b.epicTitle));
  for (const group of result) {
    group.slices.sort((a, b) => a.slice - b.slice || compareStrings(a.id, b.id));
  }

  return { groups: result, ungrouped };
}

/** Find the most specific known epic matching `name`, or `null`. */
function matchEpic(name: string, sortedEpics: SliceEpic[]): SliceEpic | null {
  const target = normalize(name);

  const exact = sortedEpics.find((epic) => normalize(epic.title) === target);
  if (exact) return exact;

  // Prefix match on a word boundary so "ExpensesQ3" never matches "Expenses".
  return (
    sortedEpics.find((epic) => target.startsWith(`${normalize(epic.title)} `)) ?? null
  );
}

/** Lowercase and collapse whitespace for stable comparison. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Locale-independent string comparison for deterministic ordering. */
function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
