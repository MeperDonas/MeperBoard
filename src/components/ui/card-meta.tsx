import { CircleDot, GitPullRequest } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils";
import { formatRelativeShort } from "../../lib/relative-date";
import { getRepoColorScheme, getRepoShortName } from "../../lib/repo-colors";
import { Badge } from "./badge";

/**
 * Shared card metadata composition (UX rounds 2–3): the exact same meta row
 * renders on board cards, ghost cards, and backlog rows.
 *
 * Round-3 hierarchy cleanup: number and kind are plain MUTED inline text
 * (no bordered chips), the state stays a colored chip (Open green / Closed
 * muted), and the relative date sits right-aligned in muted tabular text.
 * Label tags render on their own tighter line below (callers own that split).
 * Local cards keep their primary "Local" pill for instant source recognition;
 * missing fields (e.g. local cards have no number or state) are simply
 * omitted — data is never invented.
 */

/** Structural slice of the state-layer `Card` this module needs. */
export interface CardMetaInfo {
  type: "issue" | "pull" | "local";
  number: number | null;
  state: string | null;
  updatedAt: string;
  repo?: string | null;
}

export function formatState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

const KIND_META = {
  issue: { label: "Issue", Icon: CircleDot },
  pull: { label: "PR", Icon: GitPullRequest },
} as const;

/**
 * Source/kind marker: local cards keep their primary "Local" pill (as in
 * round 1); GitHub cards show their distinct lucide kind icon inline.
 */
export function CardSourceKindBadge({ type }: { type: CardMetaInfo["type"] }) {
  if (type === "local") {
    return <Badge variant="primary">Local</Badge>;
  }
  const meta = KIND_META[type];
  if (!meta) return null;
  const { Icon } = meta;
  return (
    <Icon
      className="h-3 w-3 shrink-0 text-primary/70 transition-colors group-hover:text-primary"
      aria-hidden="true"
    />
  );
}

/**
 * Distinctive repository badge with custom scheme without bullet dot.
 */
export function CardRepoBadge({ repo }: { repo?: string | null }) {
  if (!repo) return null;
  const scheme = getRepoColorScheme(repo);
  const shortName = getRepoShortName(repo);
  return (
    <span
      title={repo}
      className={cn(
        "inline-flex items-center rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-semibold border shadow-2xs transition-colors shrink-0",
        scheme.badge,
      )}
    >
      <span>{shortName}</span>
    </span>
  );
}

/**
 * Muted inline `#number`; hidden when the card has no number (local cards).
 * Plain text instead of an outlined chip — part of the round-3 cleanup.
 */
export function CardNumberText({ number }: { number: number | null }) {
  if (number == null) return null;
  return (
    <span className="shrink-0 font-mono text-xs tabular-nums text-primary/80 transition-colors group-hover:text-primary">
      #{number}
    </span>
  );
}

/** State chip: Open renders green via text-success, anything else muted. */
export function CardStateBadge({ state }: { state: string | null }) {
  if (state == null) return null;
  return (
    <Badge
      variant={state === "open" ? "success" : "neutral"}
      className="shrink-0 rounded-[4px] text-[10px] px-1.5 py-0.5 font-medium"
    >
      {formatState(state)}
    </Badge>
  );
}

/** Compact relative date ("3d") with the full timestamp as tooltip. */
export function CardRelativeDate({ iso, className }: { iso: string; className?: string }) {
  const relative = formatRelativeShort(iso);
  if (relative === "") return null;
  return (
    <span
      className={cn("shrink-0 font-mono text-xs tabular-nums text-muted-foreground", className)}
      title={new Date(iso).toLocaleString()}
    >
      {relative}
    </span>
  );
}

/**
 * The full meta row used by board cards and backlog rows: kind icon +
 * `#number` muted inline, state chip, optional trailing tags (label badges),
 * and the relative date pushed to the far edge of the row. Rendered inside a
 * full-width flex container by the caller so `ml-auto` lands the date at the
 * row's right edge.
 *
 * `trailing` lets narrow surfaces (backlog rows) keep labels on the same
 * line; wide surfaces (board cards) omit it and stack labels below instead.
 */
export function CardMetaRow({
  card,
  trailing,
}: {
  card: CardMetaInfo;
  trailing?: ReactNode;
}) {
  const kindLabel =
    card.type === "local" || !KIND_META[card.type] ? null : KIND_META[card.type].label;

  return (
    <>
      <CardSourceKindBadge type={card.type} />
      <span className="inline-flex items-center gap-1 shrink-0">
        <CardNumberText number={card.number} />
        {kindLabel != null && (
          <span className="text-xs text-muted-foreground">{kindLabel}</span>
        )}
      </span>
      <CardRepoBadge repo={card.repo} />
      <CardStateBadge state={card.state} />
      {trailing}
      <CardRelativeDate iso={card.updatedAt} className="ml-auto" />
    </>
  );
}
