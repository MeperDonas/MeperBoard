"use client";

import { ArrowDown, ArrowUp, ChevronDown, FilterX, Inbox } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import {
  filterCards,
  sortCards,
  useBacklog,
  type BacklogFilters,
  type BacklogSort,
  type Card,
  type CardType,
  type SortDirection,
  type SortField,
} from "../../state";

type TypeFilter = CardType | "all";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "issue", label: "Issues" },
  { value: "pull", label: "Pull requests" },
  { value: "local", label: "Local" },
];

const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
];

const TYPE_LABEL: Record<CardType, string> = {
  issue: "Issue",
  pull: "PR",
  local: "Local",
};

const ALL_LABELS = "all";

const selectClassName =
  "appearance-none rounded-lg border bg-card py-1.5 pl-3 pr-9 text-sm text-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20";

/**
 * Flat backlog: every card (GitHub + local) in one filterable, sortable list.
 *
 * The data comes from `useBacklog()` (the unified card projection); filtering
 * and sorting reuse the same pure `filterCards`/`sortCards` helpers the hook
 * uses, applied client-side so label/type options derive from the full set and
 * controls respond instantly.
 */
export function Backlog() {
  const { data, isPending, isError } = useBacklog();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [labelFilter, setLabelFilter] = useState<string>(ALL_LABELS);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const cards = data ?? [];

  const labels = useMemo(
    () => Array.from(new Set(cards.flatMap((card) => card.labels))).sort(),
    [cards],
  );

  const filters: BacklogFilters = useMemo(() => {
    const result: BacklogFilters = {};
    if (typeFilter !== "all") result.type = typeFilter;
    if (labelFilter !== ALL_LABELS) result.label = labelFilter;
    return result;
  }, [typeFilter, labelFilter]);

  const sort: BacklogSort = useMemo(
    () => ({ field: sortField, direction: sortDir }),
    [sortField, sortDir],
  );

  const visible = useMemo(
    () => sortCards(filterCards(cards, filters), sort),
    [cards, filters, sort],
  );

  if (isPending) {
    return <BacklogSkeleton />;
  }
  if (isError) {
    return <BacklogStatus>Failed to load the backlog.</BacklogStatus>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-6" role="region" aria-label="Backlog">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Type</span>
          <span className="relative inline-flex items-center">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className={selectClassName}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Label</span>
          <span className="relative inline-flex items-center">
            <select
              value={labelFilter}
              onChange={(event) => setLabelFilter(event.target.value)}
              className={selectClassName}
            >
              <option value={ALL_LABELS}>All labels</option>
              {labels.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Sort by</span>
          <span className="relative inline-flex items-center">
            <select
              value={sortField}
              onChange={(event) => setSortField(event.target.value as SortField)}
              className={selectClassName}
            >
              {SORT_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </span>
        </label>

        <button
          type="button"
          onClick={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
          aria-label="Toggle sort direction"
          aria-pressed={sortDir === "desc"}
          title="Toggle sort direction"
          className="rounded-lg border bg-card p-2 text-foreground shadow-xs transition-colors duration-150 hover:bg-muted"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {visible.length === 0 ? (
        cards.length === 0 ? (
          <EmptyState />
        ) : (
          <NoMatches />
        )
      ) : (
        <ul aria-label="Backlog items" className="flex flex-col gap-1.5">
          {visible.map((card) => (
            <BacklogRow key={card.id} card={card} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BacklogRow({ card }: { card: Card }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-xs transition-colors duration-150 hover:border-foreground/20">
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
          card.source === "local"
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {TYPE_LABEL[card.type]}
      </span>

      <div className="min-w-0 flex-1">
        <p
          data-testid="backlog-title"
          className="truncate text-sm font-medium leading-snug"
          title={card.title}
        >
          {card.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {card.state != null && (
            <span className="text-xs text-muted-foreground">{formatState(card.state)}</span>
          )}
          {card.labels.map((label) => (
            <span
              key={label}
              className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

function BacklogStatus({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto w-full max-w-4xl p-4 text-sm text-muted-foreground md:p-6">{children}</p>
  );
}

/** Row-shaped placeholders while the backlog query resolves. */
function BacklogSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-4xl p-4 md:p-6"
      role="status"
      aria-label="Loading backlog"
    >
      <div className="mb-4 flex gap-3">
        {[0, 1, 2].map((field) => (
          <div key={field} className="h-9 w-32 animate-pulse rounded-lg bg-muted/70" />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="h-14 animate-pulse rounded-lg bg-muted/70" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed p-8 text-center">
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No items yet</p>
      <p className="text-xs text-muted-foreground">
        Sync your GitHub issues or add a local card to get started.
      </p>
    </div>
  );
}

function NoMatches() {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed p-8 text-center">
      <FilterX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No items match the current filters</p>
      <p className="text-xs text-muted-foreground">Try widening the type or label filter.</p>
    </div>
  );
}

function formatState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
