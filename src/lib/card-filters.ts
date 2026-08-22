import type { Card } from "../state/cards";

/**
 * Client-side title search for the backlog. Kept pure and separate from
 * `filterCards` (state layer) so the data-layer files stay untouched.
 */

/** Case-insensitive substring match on the card title; empty query matches all. */
export function filterByTitle(cards: readonly Card[], query: string): Card[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...cards];
  return cards.filter((card) => card.title.toLowerCase().includes(needle));
}

export interface CardTypeCounts {
  issue: number;
  pull: number;
  local: number;
}

/** Count cards by type for the "128 issues · 12 local" summary. */
export function countByType(cards: readonly Card[]): CardTypeCounts {
  const counts: CardTypeCounts = { issue: 0, pull: 0, local: 0 };
  for (const card of cards) {
    if (card.type === "issue" || card.type === "pull" || card.type === "local") {
      counts[card.type] += 1;
    }
  }
  return counts;
}

const TYPE_UNIT: Record<keyof CardTypeCounts, string> = {
  issue: "issues",
  pull: "PRs",
  local: "local",
};

/**
 * Human summary like "3 issues · 2 PRs · 12 local". Zero segments are omitted;
 * an empty board renders "No items".
 */
export function formatCardSummary(counts: CardTypeCounts): string {
  const parts = (Object.keys(counts) as Array<keyof CardTypeCounts>)
    .filter((type) => counts[type] > 0)
    .map((type) => `${counts[type]} ${TYPE_UNIT[type]}`);
  return parts.length > 0 ? parts.join(" · ") : "No items";
}
