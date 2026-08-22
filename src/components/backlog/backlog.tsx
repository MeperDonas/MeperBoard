"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
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
import { clampPage, DEFAULT_PAGE_SIZE, PAGER_VISIBLE_ABOVE, PAGE_SIZE_OPTIONS, paginate, sanitizePageSize, type PageSizeOption } from "../../lib/pagination";
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
import { CardMetaRow } from "../ui/card-meta";
import { Select } from "../ui/select";

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

const STATUS_OPTIONS: { value: LocalStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const ALL_LABELS = "all";

const searchClassName =
  "w-full rounded-lg border bg-card py-1.5 pl-8 pr-3 text-sm text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20";

const editorInputClassName =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20";

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
 * UX round 2 added: debounced title search, group-by with sticky headers,
 * localStorage-persisted sort, shared meta badges (#number, kind, state,
 * relative date), row quick actions (open on GitHub / edit / delete for
 * local cards), j/k roving-focus keyboard navigation with Enter opening the
 * issue detail route, and window virtualization once the rendered list grows
 * past a threshold — virtualization runs on the flat post-grouping order so
 * grouped and ungrouped views scale identically.
 *
 * UX round 3 adds: a visible-limit pager (25 / 50 / 100 rows per page, default
 * 25) applied BEFORE grouping and virtualization so lists never pile up, and
 * custom popover selects replacing every OS-native dropdown.
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
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
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

  const LABEL_OPTIONS = useMemo(
    () => [
      { value: ALL_LABELS, label: "All labels" },
      ...labels.map((label) => ({ value: label, label })),
    ],
    [labels],
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

  // Pipeline order: filters → title search → sort → PAGINATE → group → flat
  // render list. Pagination runs before grouping so a page slice is exactly
  // what renders; the virtualizer (if any) only ever sees one page.
  const visible = useMemo(
    () => sortCards(filterByTitle(filterCards(cards, filters), searchQuery), sort),
    [cards, filters, searchQuery, sort],
  );
  const effectivePage = clampPage(visible.length, pageSize, page);
  const paged = useMemo(
    () => paginate(visible, effectivePage, pageSize),
    [visible, effectivePage, pageSize],
  );
  const groups = useMemo(() => groupCards(paged.items, groupBy), [paged, groupBy]);
  const entries = useMemo(() => flattenGroups(groups), [groups]);
  const rowCount = useMemo(
    () => entries.reduce((count, entry) => (entry.kind === "row" ? count + 1 : count), 0),
    [entries],
  );

  // Any change to search/filter/group/sort/page size restarts at page 1 —
  // stale page indices would otherwise show empty or wrong slices.
  const viewSignature = `${typeFilter}|${labelFilter}|${searchQuery}|${sortField}|${sortDir}|${groupBy}|${pageSize}`;
  useEffect(() => {
    setPage(1);
  }, [viewSignature]);

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
    // Never hijack keys typed into inline editors or the custom combobox
    // triggers inside a row (native selects became buttons in round 3).
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("input, textarea, select, button[role='combobox']")
    ) {
      return;
    }
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

        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Type</span>
          <Select
            aria-label="Type"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onValueChange={(next) => setTypeFilter(next as TypeFilter)}
            className="w-32"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Label</span>
          <Select
            aria-label="Label"
            options={LABEL_OPTIONS}
            value={labelFilter}
            onValueChange={setLabelFilter}
            className="w-44"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Group by</span>
          <Select
            aria-label="Group by"
            options={GROUP_OPTIONS}
            value={groupBy}
            onValueChange={(next) => setGroupBy(next as BacklogGroupKey)}
            className="w-32"
          />
        </div>

        <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Sort by</span>
          <Select
            aria-label="Sort by"
            options={SORT_FIELD_OPTIONS}
            value={sortField}
            onValueChange={(next) => setSortField(next as SortField)}
            className="w-28"
          />
        </div>

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
        <>
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
          {paged.totalItems > PAGER_VISIBLE_ABOVE && (
            <BacklogPager
              page={paged.page}
              totalPages={paged.totalPages}
              totalItems={paged.totalItems}
              pageSize={paged.pageSize}
              onPageChange={setPage}
              onPageSizeChange={(next) => setPageSize(sanitizePageSize(next))}
            />
          )}
        </>
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

const pagerButtonClassName =
  "rounded-lg border bg-card p-1.5 text-muted-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground";

/**
 * Pagination footer (UX round 3): Prev / "Page N of M" / Next plus a page-size
 * selector. Rendered whenever the filtered list exceeds the default page size
 * (25), even if a larger page size could fit everything — switching sizes must
 * stay discoverable. Lists at or below the threshold never paginate.
 */
function BacklogPager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(totalItems, page * pageSize);

  return (
    <nav
      data-testid="backlog-pager"
      aria-label="Backlog pagination"
      className="mt-3 flex items-center justify-between gap-3"
    >
      <p className="text-xs tabular-nums text-muted-foreground">
        Showing {first}–{last} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            title="Previous page"
            className={pagerButtonClassName}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            className="min-w-20 px-1 text-center text-xs tabular-nums text-muted-foreground"
          >
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            title="Next page"
            className={pagerButtonClassName}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <Select
          aria-label="Rows per page"
          size="sm"
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: String(size),
            label: `${size} / page`,
          }))}
          value={String(pageSize)}
          onValueChange={(next) => onPageSizeChange(Number(next))}
          className="w-28"
        />
      </div>
    </nav>
  );
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
        <div className="mt-1 flex w-full items-center gap-2">
          <CardMetaRow
            card={card}
            trailing={
              <>
                {card.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </>
            }
          />
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
        <div className="shrink-0">
          <Select
            aria-label="Edit card status"
            size="sm"
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(next) => setStatus(next as LocalStatus)}
            className="w-24"
          />
        </div>
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
