"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ExternalLink,
  FilterX,
  Inbox,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";

import { localStatusStrategy, type LocalStatus } from "../../domain/columns";
import {
  flattenGroups,
  groupCards,
  type BacklogGroupKey,
  type FlatBacklogEntry,
} from "../../domain/grouping";
import {
  BACKLOG_HEADER_HEIGHT,
  BACKLOG_OVERSCAN,
  BACKLOG_ROW_HEIGHT,
  shouldVirtualize,
} from "../../lib/capping";
import { filterByTitle } from "../../lib/card-filters";
import { loadStoredBacklogSort, saveBacklogSort } from "../../lib/backlog-sort-storage";
import { SEARCH_DEBOUNCE_MS } from "../../lib/config";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { useGuardedRouter } from "../../lib/use-guarded-router";
import { cn } from "../../lib/utils";
import {
  DEFAULT_REPO,
  filterCards,
  parseLocalCardId,
  sortCards,
  useBacklog,
  type BacklogFilters,
  type BacklogSort,
  type Card,
  type CardType,
  type SortDirection,
  type SortField,
} from "../../state";
import { Badge } from "../ui/badge";
import { CardMetaBadges } from "../ui/card-meta";

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

const GROUP_OPTIONS: { value: BacklogGroupKey; label: string }[] = [
  { value: "none", label: "None" },
  { value: "type", label: "Type" },
  { value: "state", label: "State" },
  { value: "source", label: "Source" },
];

const ALL_LABELS = "all";

const selectClassName =
  "appearance-none rounded-lg border bg-card py-1.5 pl-3 pr-9 text-sm text-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20";

const searchClassName =
  "w-full rounded-lg border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20";

const editorInputClassName =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20";

const editorSelectClassName =
  "appearance-none rounded-lg border bg-background py-1.5 pl-2.5 pr-8 text-sm text-foreground transition-colors duration-150 hover:border-foreground/20";

/** Patch applied to a local card through the workspace-composed handler. */
export interface BacklogLocalCardPatch {
  title: string;
  body: string;
  columnId: string;
}

export interface BacklogLocalActions {
  onEditLocal?: (id: string, patch: BacklogLocalCardPatch) => void;
  onDeleteLocal?: (id: string) => void;
}

export interface BacklogProps {
  /**
   * Quick edit/delete for `source === "local"` rows. Wired by the workspace
   * composition (BacklogPage) through the existing `useLocalCards` mutations;
   * when absent the actions simply don't render.
   */
  localActions?: BacklogLocalActions;
}

/**
 * Flat backlog: every card (GitHub + local) in one searchable, filterable,
 * sortable, groupable list.
 *
 * UX round 2 adds: debounced title search, group-by with sticky headers,
 * localStorage-persisted sort, shared meta badges (#number, kind, state,
 * relative date), row quick actions (open on GitHub / edit / delete for
 * local cards), j/k roving-focus keyboard navigation with Enter opening the
 * issue detail route, and window virtualization once the rendered list grows
 * past a threshold — virtualization runs on the flat post-grouping order so
 * grouped and ungrouped views scale identically.
 */
export function Backlog({ localActions }: BacklogProps = {}) {
  const { data, isPending, isError } = useBacklog();
  const router = useGuardedRouter();
  const reduceMotion = useReducedMotion() ?? false;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [labelFilter, setLabelFilter] = useState<string>(ALL_LABELS);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [groupBy, setGroupBy] = useState<BacklogGroupKey>("none");
  const [searchInput, setSearchInput] = useState("");
  const searchQuery = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const rowRefs = useRef(new Map<number, HTMLElement>());

  // Restore the persisted sort after mount (never during SSR render).
  useEffect(() => {
    const stored = loadStoredBacklogSort();
    if (stored?.field) setSortField(stored.field);
    if (stored?.direction) setSortDir(stored.direction);
  }, []);

  useEffect(() => {
    saveBacklogSort({ field: sortField, direction: sortDir });
  }, [sortField, sortDir]);

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

  // Pipeline order: filters → title search → sort → group → flat render list.
  const visible = useMemo(
    () => sortCards(filterByTitle(filterCards(cards, filters), searchQuery), sort),
    [cards, filters, searchQuery, sort],
  );
  const groups = useMemo(() => groupCards(visible, groupBy), [visible, groupBy]);
  const entries = useMemo(() => flattenGroups(groups), [groups]);
  const rowCount = useMemo(
    () => entries.reduce((count, entry) => (entry.kind === "row" ? count + 1 : count), 0),
    [entries],
  );

  // Keep roving focus in bounds when the visible list shrinks.
  useEffect(() => {
    setFocusIndex((current) => Math.min(current, Math.max(0, rowCount - 1)));
  }, [rowCount]);

  useEffect(() => () => rowRefs.current.clear(), []);

  if (isPending) {
    return <BacklogSkeleton />;
  }
  if (isError) {
    return <BacklogStatus>Failed to load the backlog.</BacklogStatus>;
  }

  function registerRowRef(index: number, node: HTMLElement | null) {
    if (node) rowRefs.current.set(index, node);
    else rowRefs.current.delete(index);
  }

  function moveFocus(delta: -1 | 1) {
    if (rowCount === 0) return;
    const next = Math.min(rowCount - 1, Math.max(0, focusIndex + delta));
    setFocusIndex(next);
    rowRefs.current.get(next)?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Never hijack keys typed into inline editors or selects inside a row.
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select")) return;
    if (event.key === "j") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "k") {
      event.preventDefault();
      moveFocus(-1);
    }
  }

  /** Detail route resolves against the default repo only — never guess. */
  function canOpenDetail(card: Card): boolean {
    return (
      card.source === "github" &&
      card.number != null &&
      card.repo === `${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`
    );
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>, card: Card) {
    if (event.key !== "Enter" || event.target !== event.currentTarget) return;
    if (!canOpenDetail(card)) return;
    event.preventDefault();
    const href = `/issues/${card.number}`;
    if (router) router.push(href);
    else window.location.assign(href);
  }

  function saveLocalEdit(card: Card, patch: BacklogLocalCardPatch) {
    const localId = parseLocalCardId(card.id);
    if (!localId) return;
    localActions?.onEditLocal?.(localId, patch);
    setEditingId(null);
  }

  const viewSignature = `${typeFilter}|${labelFilter}|${searchQuery}|${sortField}|${sortDir}|${groupBy}`;

  const listProps = {
    entries,
    focusIndex,
    editingId,
    registerRowRef,
    onKeyDownList: handleListKeyDown,
    onRowKeyDown: handleRowKeyDown,
    onStartEdit: (card: Card) => setEditingId(parseLocalCardId(card.id)),
    onCancelEdit: () => setEditingId(null),
    onSaveEdit: saveLocalEdit,
    localActions,
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-6" role="region" aria-label="Backlog">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Search</span>
          <span className="relative inline-flex items-center">
            <Search
              className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Filter by title…"
              className={searchClassName}
            />
          </span>
        </label>

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
          <span>Group by</span>
          <span className="relative inline-flex items-center">
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value as BacklogGroupKey)}
              className={selectClassName}
            >
              {GROUP_OPTIONS.map((option) => (
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
        <motion.div
          key={viewSignature}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          {shouldVirtualize(entries.length) ? (
            <VirtualEntryList {...listProps} />
          ) : (
            <PlainEntryList {...listProps} />
          )}
        </motion.div>
      )}
    </div>
  );
}

interface EntryListProps {
  entries: FlatBacklogEntry<Card>[];
  focusIndex: number;
  editingId: string | null;
  registerRowRef: (index: number, node: HTMLElement | null) => void;
  onKeyDownList: (event: KeyboardEvent<HTMLElement>) => void;
  onRowKeyDown: (event: KeyboardEvent<HTMLElement>, card: Card) => void;
  onStartEdit: (card: Card) => void;
  onCancelEdit: () => void;
  onSaveEdit: (card: Card, patch: BacklogLocalCardPatch) => void;
  localActions?: BacklogLocalActions;
}

/**
 * Plain path for small lists (and jsdom tests): semantic ul/li markup, every
 * entry mounted. Group headers are sticky here too, so behavior matches the
 * virtualized path exactly.
 */
function PlainEntryList({
  entries,
  focusIndex,
  editingId,
  registerRowRef,
  onKeyDownList,
  onRowKeyDown,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  localActions,
}: EntryListProps) {
  let rowIndex = -1;
  return (
    <ul
      aria-label="Backlog items"
      onKeyDown={onKeyDownList}
      className="flex flex-col gap-1.5"
    >
      {entries.map((entry) => {
        if (entry.kind === "header") {
          return (
            <li
              key={entry.id}
              role="presentation"
              className="sticky top-14 z-20 h-9 bg-background"
            >
              <GroupHeader label={entry.label} count={entry.count} />
            </li>
          );
        }
        rowIndex += 1;
        const currentRow = rowIndex;
        return (
          <li
            key={entry.id}
            ref={(node) => registerRowRef(currentRow, node)}
            tabIndex={currentRow === focusIndex ? 0 : -1}
            onKeyDown={(event) => onRowKeyDown(event, entry.card)}
            className={cn(rowClassName, "py-2.5")}
          >
            {editingId === entry.card.id ? (
              <LocalRowEditor
                card={entry.card}
                onCancel={onCancelEdit}
                onSave={(patch) => onSaveEdit(entry.card, patch)}
              />
            ) : (
              <BacklogRowContent
                card={entry.card}
                localActions={localActions}
                onEdit={() => onStartEdit(entry.card)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Windowed path for large lists: renders only the rows near the viewport
 * (fixed heights + overscan) with flow spacers preserving scroll accuracy.
 * Sticky group headers keep working because items stay in normal document
 * flow instead of absolute positioning.
 */
function VirtualEntryList({
  entries,
  focusIndex,
  editingId,
  registerRowRef,
  onKeyDownList,
  onRowKeyDown,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  localActions,
}: EntryListProps) {
  const virtualizer = useWindowVirtualizer({
    count: entries.length,
    estimateSize: (index) =>
      entries[index].kind === "header" ? BACKLOG_HEADER_HEIGHT : BACKLOG_ROW_HEIGHT,
    overscan: BACKLOG_OVERSCAN,
    getItemKey: (index) => entries[index].id,
  });
  const items = virtualizer.getVirtualItems();

  const padTop = items.length > 0 ? items[0].start : 0;
  const last = items[items.length - 1];
  const padBottom =
    last != null ? Math.max(0, virtualizer.getTotalSize() - last.end) : 0;

  let rowIndex = -1;
  return (
    <div role="list" aria-label="Backlog items" onKeyDown={onKeyDownList} className="flex flex-col">
      {padTop > 0 && <div aria-hidden="true" style={{ height: padTop }} />}
      {items.map((virtualItem) => {
        const entry = entries[virtualItem.index];
        if (entry.kind === "header") {
          return (
            <div
              key={virtualItem.key}
              style={{ height: BACKLOG_HEADER_HEIGHT }}
              className="sticky top-14 z-20 bg-background"
            >
              <GroupHeader label={entry.label} count={entry.count} />
            </div>
          );
        }
        rowIndex += 1;
        const currentRow = rowIndex;
        return (
          <div
            key={virtualItem.key}
            ref={(node) => registerRowRef(currentRow, node)}
            role="listitem"
            tabIndex={currentRow === focusIndex ? 0 : -1}
            onKeyDown={(event) => onRowKeyDown(event, entry.card)}
            style={{ height: BACKLOG_ROW_HEIGHT }}
            className={cn(rowClassName, "overflow-hidden")}
          >
            {editingId === entry.card.id ? (
              <LocalRowEditor
                card={entry.card}
                onCancel={onCancelEdit}
                onSave={(patch) => onSaveEdit(entry.card, patch)}
              />
            ) : (
              <BacklogRowContent
                card={entry.card}
                localActions={localActions}
                onEdit={() => onStartEdit(entry.card)}
              />
            )}
          </div>
        );
      })}
      {padBottom > 0 && <div aria-hidden="true" style={{ height: padBottom }} />}
    </div>
  );
}

const rowClassName =
  "flex items-center gap-3 rounded-lg border bg-card px-3.5 shadow-xs transition-colors duration-150 hover:border-foreground/20 focus-visible:border-primary/60";

/**
 * Sticky group header content (label + count pill). The sticky positioning
 * and opaque background are applied by the wrapping flow item in each list
 * path, since sticky must live on the element participating in scroll flow.
 */
function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex h-full items-center gap-1.5 px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
      <Badge variant="neutral" className="tabular-nums normal-case">
        {count}
      </Badge>
    </div>
  );
}

function BacklogRowContent({
  card,
  localActions,
  onEdit,
}: {
  card: Card;
  localActions?: BacklogLocalActions;
  onEdit: () => void;
}) {
  const localId = parseLocalCardId(card.id);
  return (
    <>
      <div className="min-w-0 flex-1">
        <p
          data-testid="backlog-title"
          className="truncate text-sm font-medium leading-snug"
          title={card.title}
        >
          {card.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <CardMetaBadges card={card} />
          {card.labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {card.htmlUrl != null && (
          <a
            href={card.htmlUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${card.title} on GitHub`}
            title="Open on GitHub"
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
        {localId != null && localActions?.onEditLocal != null && (
          <button
            type="button"
            aria-label={`Edit ${card.title}`}
            title="Edit"
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {localId != null && localActions?.onDeleteLocal != null && (
          <button
            type="button"
            aria-label={`Delete ${card.title}`}
            title="Delete"
            onClick={() => localActions.onDeleteLocal?.(localId)}
            className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

/** Inline editor mirroring LocalCards' edit form, compacted for a row. */
function LocalRowEditor({
  card,
  onCancel,
  onSave,
}: {
  card: Card;
  onCancel: () => void;
  onSave: (patch: BacklogLocalCardPatch) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [status, setStatus] = useState<LocalStatus>(statusForColumn(card.columnId));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      body: body.trim(),
      columnId: localStatusStrategy.columnFor(status),
    });
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Edit card ${card.title}`} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Edit card title"
          className={editorInputClassName}
        />
        <span className="relative inline-flex shrink-0 items-center">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as LocalStatus)}
            aria-label="Edit card status"
            className={editorSelectClassName}
          >
            <option value="todo">To Do</option>
            <option value="doing">Doing</option>
            <option value="done">Done</option>
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground"
            aria-hidden="true"
          />
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-2.5 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Edit card description"
        rows={2}
        className={cn(editorInputClassName, "mt-2")}
      />
    </form>
  );
}

/** Map a local card's stored column back to its status (as in LocalCards). */
function statusForColumn(columnId: string): LocalStatus {
  if (columnId === "doing") return "doing";
  if (columnId === "done") return "done";
  return "todo";
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
