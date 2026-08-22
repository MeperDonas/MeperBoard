"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { motion, useReducedMotion } from "framer-motion";
import { FilterX, Inbox } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

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
import {
  clampPage,
  DEFAULT_PAGE_SIZE,
  PAGER_VISIBLE_ABOVE,
  paginate,
  sanitizePageSize,
  type PageSizeOption,
} from "../../lib/pagination";
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
  type SortDirection,
  type SortField,
} from "../../state";
import { Badge } from "../ui/badge";
import { BacklogEditForm, type BacklogLocalCardPatch } from "./backlog-edit-form";
import { BacklogPaginator } from "./backlog-paginator";
import { BacklogRowContent } from "./backlog-row";
import {
  ALL_LABELS,
  BacklogToolbar,
  type TypeFilter,
} from "./backlog-toolbar";

export type { BacklogLocalCardPatch };

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
 * UX overhaul:
 * - Refactored into modular subcomponents (toolbar, row, edit form, paginator).
 * - Two-step inline delete confirmation (no disruptive window.confirm alerts).
 * - Unified Input and Button primitives across filter and edit controls.
 * - Dynamic sort direction accessibility announcements.
 */
export function Backlog({ localActions }: BacklogProps = {}) {
  const { data, isPending, isError } = useBacklog();
  const router = useGuardedRouter();
  const reduceMotion = useReducedMotion() ?? false;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [labelFilter, setLabelFilter] = useState<string>(ALL_LABELS);
  const [sortField, setSortField] = useState<SortField>("updated");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
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

  const labelOptions = useMemo(
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

  // Pipeline order: filters → title search → sort → PAGINATE → group → flat render list.
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

  const viewSignature = `${typeFilter}|${labelFilter}|${searchQuery}|${sortField}|${sortDir}|${groupBy}|${pageSize}`;
  useEffect(() => {
    setPage(1);
  }, [viewSignature]);

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
      <BacklogToolbar
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        labelFilter={labelFilter}
        onLabelFilterChange={setLabelFilter}
        labelOptions={labelOptions}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortField={sortField}
        onSortFieldChange={setSortField}
        sortDir={sortDir}
        onToggleSortDir={() => setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))}
      />

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
            <BacklogPaginator
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

const rowClassName =
  "flex items-center gap-3 rounded-lg border bg-card px-3.5 shadow-xs transition-all duration-150 hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-md hover:shadow-primary/5 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/40";

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
              className="sticky top-14 z-20 py-1"
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
              <BacklogEditForm
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
      entries[index]?.kind === "header" ? BACKLOG_HEADER_HEIGHT : BACKLOG_ROW_HEIGHT,
    overscan: BACKLOG_OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const padTop = virtualItems.length > 0 ? (virtualItems[0]?.start ?? 0) : 0;
  const last = virtualItems[virtualItems.length - 1];
  const padBottom =
    virtualItems.length > 0 && last
      ? virtualizer.getTotalSize() - last.end
      : 0;

  // Map each virtual item to its row index among row entries only.
  let rowCountSoFar = 0;
  const rowIndices = entries.map((entry) => {
    if (entry.kind === "header") return -1;
    const index = rowCountSoFar;
    rowCountSoFar += 1;
    return index;
  });

  return (
    <div
      role="list"
      aria-label="Backlog items"
      onKeyDown={onKeyDownList}
      className="flex flex-col gap-1.5"
    >
      {padTop > 0 && <div aria-hidden="true" style={{ height: padTop }} />}
      {virtualItems.map((virtualItem) => {
        const entry = entries[virtualItem.index];
        if (!entry) return null;
        if (entry.kind === "header") {
          return (
            <div
              key={entry.id}
              role="presentation"
              className="sticky top-14 z-20 py-1"
            >
              <GroupHeader label={entry.label} count={entry.count} />
            </div>
          );
        }
        const currentRow = rowIndices[virtualItem.index] ?? -1;
        return (
          <div
            key={entry.id}
            role="listitem"
            ref={(node) => registerRowRef(currentRow, node)}
            tabIndex={currentRow === focusIndex ? 0 : -1}
            onKeyDown={(event) => onRowKeyDown(event, entry.card)}
            style={{ height: BACKLOG_ROW_HEIGHT }}
            className={cn(rowClassName, "overflow-hidden")}
          >
            {editingId === entry.card.id ? (
              <BacklogEditForm
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

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card/95 px-3.5 py-1.5 shadow-xs backdrop-blur-md">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground/90">
        <span className="h-2 w-2 rounded-full bg-primary shadow-xs ring-1 ring-primary/40" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <Badge variant="accent" className="tabular-nums font-mono normal-case">
        {count}
      </Badge>
    </div>
  );
}

function BacklogStatus({ children }: { children: ReactNode }) {
  return (
    <p className="mx-auto w-full max-w-4xl p-4 text-sm text-muted-foreground md:p-6">{children}</p>
  );
}

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
