import { CircleDot, GitPullRequest } from "lucide-react";

import { formatRelativeShort } from "../../lib/relative-date";
import { Badge } from "./badge";

/**
 * Shared card metadata composition (UX round 2): the exact same badge cluster
 * renders on board cards and backlog rows.
 *
 * First badge doubles as source + kind, preserving round-1 visuals: local
 * cards keep their primary "Local" pill; GitHub items get a neutral pill with
 * a distinct lucide icon per kind (Issue vs PR). Then `#number`, state chip
 * (Open green / Closed muted), and a compact relative date derived from the
 * card's own timestamps. Missing fields (e.g. local cards have no number or
 * state) simply omit their badge — data is never invented.
 */

/** Structural slice of the state-layer `Card` this module needs. */
export interface CardMetaInfo {
  type: "issue" | "pull" | "local";
  number: number | null;
  state: string | null;
  updatedAt: string;
}

export function formatState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

const KIND_META = {
  issue: { label: "Issue", Icon: CircleDot },
  pull: { label: "PR", Icon: GitPullRequest },
} as const;

/**
 * Source/kind badge: "Local" (primary, as-is from round 1) or a GitHub kind
 * tag ("Issue"/"PR") with its distinct icon.
 */
export function CardSourceKindBadge({ type }: { type: CardMetaInfo["type"] }) {
  if (type === "local") {
    return <Badge variant="primary">Local</Badge>;
  }
  const meta = KIND_META[type];
  if (!meta) return null;
  const { label, Icon } = meta;
  return (
    <Badge variant="neutral">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** `#number` chip; hidden when the card has no number (local cards). */
export function CardNumberBadge({ number }: { number: number | null }) {
  if (number == null) return null;
  return (
    <Badge variant="outline" className="tabular-nums">
      #{number}
    </Badge>
  );
}

/** State chip: Open renders green via text-success, anything else muted. */
export function CardStateBadge({ state }: { state: string | null }) {
  if (state == null) return null;
  return <Badge variant={state === "open" ? "success" : "neutral"}>{formatState(state)}</Badge>;
}

/** Compact relative date ("3d") with the full timestamp as tooltip. */
export function CardRelativeDate({ iso }: { iso: string }) {
  const relative = formatRelativeShort(iso);
  if (relative === "") return null;
  return (
    <span
      className="shrink-0 text-xs tabular-nums text-muted-foreground"
      title={new Date(iso).toLocaleString()}
    >
      {relative}
    </span>
  );
}

/** The full meta row used by both board cards and backlog rows. */
export function CardMetaBadges({ card }: { card: CardMetaInfo }) {
  return (
    <>
      <CardSourceKindBadge type={card.type} />
      <CardNumberBadge number={card.number} />
      <CardStateBadge state={card.state} />
      <CardRelativeDate iso={card.updatedAt} />
    </>
  );
}
