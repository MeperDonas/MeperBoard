"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, GripVertical, Inbox, MoveLeft, MoveRight } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { remainingCardCount, visibleCardCount } from "../../lib/capping";
import { MAX_WIP_PER_COLUMN } from "../../lib/config";
import { useBoard, type Board, type BoardColumn as BoardColumnType, type Card } from "../../state";
import { Badge } from "../ui/badge";
import { CardMetaBadges } from "../ui/card-meta";
import { MoveToast, type MoveToastState } from "./move-toast";
import { adjacentColumnId, applyMoves, resolveMove, type BoardMove } from "./move";

export type { BoardMove } from "./move";

export interface BoardProps {
  /** Invoked when a card moves between columns, for consumers to persist. */
  onMoveCard?: (move: BoardMove) => void;
}

/**
 * Kanban board: ordered columns over the unified card projection. Supports
 * pointer drag (dnd-kit) and a keyboard/single-pointer alternative (move
 * left/right controls), so a drag gesture is never required (WCAG 2.2 AA).
 *
 * UX round 2 adds: a DragOverlay ghost while dragging (the origin slot dims),
 * shared-layout flight when cards land or reorder (framer-motion `layoutId`),
 * per-column windowing ("Show N more") so huge columns stay cheap, a WIP
 * warning on over-limit columns, and an undo toast after each move.
 *
 * The board remains read-only: it renders cards and reports moves via
 * `onMoveCard`; it never writes to GitHub or the local store itself.
 */
export function Board({ onMoveCard }: BoardProps) {
  const { data, isPending, isError } = useBoard();
  const reduceMotion = useReducedMotion() ?? false;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<MoveToastState | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  if (isPending) {
    return <BoardSkeleton />;
  }
  if (isError || !data) {
    return (
      <BoardStatus>
        <AlertCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Failed to load the board.</p>
        <p className="text-xs text-muted-foreground">Check your connection and try again.</p>
      </BoardStatus>
    );
  }

  const effective = applyMoves(data, moves);
  const totalCards = effective.columns.reduce((sum, column) => sum + column.cards.length, 0);
  const activeCard = activeId ? findCard(effective, activeId) : null;

  function handleMove(cardId: string, toColumnId: string) {
    const move = resolveMove(effective, cardId, toColumnId);
    if (!move) return;
    setMoves((previous) => ({ ...previous, [cardId]: toColumnId }));
    onMoveCard?.(move);
    const title = findCard(effective, cardId)?.title ?? "card";
    setToast({ key: Date.now(), cardId, title, fromColumnId: move.fromColumnId });
  }

  function handleUndo() {
    if (!toast) return;
    handleMove(toast.cardId, toast.fromColumnId);
    setToast(null);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    handleMove(String(active.id), String(over.id));
  }

  function handleMoveRelative(cardId: string, delta: -1 | 1) {
    const card = findCard(effective, cardId);
    if (!card) return;
    const currentColumnId = moves[cardId] ?? card.columnId;
    const target = adjacentColumnId(effective.columns, currentColumnId, delta);
    if (target) handleMove(cardId, target);
  }

  function handleExpand(columnId: string) {
    setExpandedSteps((previous) => ({ ...previous, [columnId]: (previous[columnId] ?? 0) + 1 }));
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="p-4 md:px-6" role="region" aria-label="Kanban board">
        {totalCards === 0 ? <EmptyState /> : null}
        <LayoutGroup>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {effective.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                expandedSteps={expandedSteps[column.id] ?? 0}
                onExpand={() => handleExpand(column.id)}
                onMoveRelative={handleMoveRelative}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
            {activeCard ? <GhostCard card={activeCard} /> : null}
          </DragOverlay>
        </LayoutGroup>
      </div>
      <MoveToast toast={toast} onUndo={handleUndo} onDismiss={dismissToast} />
    </DndContext>
  );
}

function BoardColumn({
  column,
  expandedSteps,
  onExpand,
  onMoveRelative,
  reduceMotion,
}: {
  column: BoardColumnType;
  expandedSteps: number;
  onExpand: () => void;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
  reduceMotion: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  // The header pill always shows the TRUE total; the list below is windowed.
  const total = column.cards.length;
  const overWip = total > MAX_WIP_PER_COLUMN;
  const hiddenCount = remainingCardCount(total, expandedSteps);
  const visibleCards = column.cards.slice(0, visibleCardCount(total, expandedSteps));

  return (
    <section
      ref={setNodeRef}
      data-column-id={column.id}
      aria-label={`${column.title} column`}
      className={cn(
        "flex min-h-48 w-72 shrink-0 flex-col rounded-xl border bg-card p-2 transition-colors duration-150",
        isOver && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      <header className="flex items-center justify-between px-2 py-1.5">
        <h2 className="text-sm font-medium tracking-tight">{column.title}</h2>
        <span
          title={overWip ? `More than ${MAX_WIP_PER_COLUMN} cards in this column` : undefined}
          className={cn(
            "min-w-6 rounded-full px-2 py-0.5 text-center text-xs tabular-nums",
            overWip
              ? "border border-warning/30 bg-warning/10 text-warning"
              : "bg-muted text-muted-foreground",
          )}
        >
          {total}
        </span>
      </header>
      <ul className="flex flex-1 flex-col gap-2">
        {visibleCards.map((card) => (
          <BoardCard
            key={card.id}
            card={card}
            onMoveRelative={onMoveRelative}
            reduceMotion={reduceMotion}
          />
        ))}
        {hiddenCount > 0 && (
          <li>
            <button
              type="button"
              onClick={onExpand}
              aria-label={`Show ${hiddenCount} more cards in ${column.title}`}
              className="w-full rounded-lg border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              Show {hiddenCount} more
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

function BoardCard({
  card,
  onMoveRelative,
  reduceMotion,
}: {
  card: Card;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
  reduceMotion: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    // Shared layoutId lets framer-motion fly the card between columns and
    // animate reorders; reduced-motion users get an instant swap instead.
    <motion.li
      ref={setNodeRef}
      layoutId={reduceMotion ? undefined : card.id}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "rounded-lg border bg-elevated p-3 text-card-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20",
        isDragging && "opacity-40 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`Drag ${card.title}`}
          className="mt-0.5 shrink-0 cursor-grab rounded text-muted-foreground transition-colors duration-150 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug" title={card.title}>
            {card.title}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <CardMetaBadges card={card} />
            {card.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 border-t pt-2">
        <button
          type="button"
          aria-label={`Move ${card.title} left`}
          onClick={() => onMoveRelative(card.id, -1)}
          className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <MoveLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${card.title} right`}
          onClick={() => onMoveRelative(card.id, 1)}
          className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
        >
          <MoveRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.li>
  );
}

/** Lifted ghost that follows the cursor during a drag (non-interactive). */
function GhostCard({ card }: { card: Card }) {
  return (
    <div
      aria-hidden="true"
      className="w-68 cursor-grabbing rounded-lg border bg-elevated p-3 text-card-foreground shadow-lg ring-1 ring-primary/30"
    >
      <p className="truncate text-sm font-medium leading-snug">{card.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <CardMetaBadges card={card} />
        {card.labels.map((label) => (
          <Badge key={label} variant="outline">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** Centered status panel used for the board error state. */
function BoardStatus({ children }: { children: ReactNode }) {
  return (
    <div className="m-4 flex flex-col items-center gap-1.5 rounded-xl border border-dashed p-8 text-center md:mx-6">
      {children}
    </div>
  );
}

/** Column-shaped placeholders while the board query resolves. */
function BoardSkeleton() {
  return (
    <div className="p-4 md:px-6" role="status" aria-label="Loading board">
      <div className="flex gap-3 overflow-hidden">
        {[0, 1, 2].map((column) => (
          <div
            key={column}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-card p-2"
          >
            <div className="mx-2 my-2 h-4 w-24 animate-pulse rounded bg-muted" />
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-muted/70" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mb-4 flex flex-col items-center gap-1.5 rounded-xl border border-dashed p-8 text-center">
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">No cards yet</p>
      <p className="text-xs text-muted-foreground">
        Sync your GitHub issues or add a local card to get started.
      </p>
    </div>
  );
}

function findCard(board: Board, cardId: string): Card | null {
  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === cardId);
    if (card) return card;
  }
  return null;
}
