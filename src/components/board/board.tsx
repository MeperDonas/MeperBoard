"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { AlertCircle, GripVertical, Inbox, MoveLeft, MoveRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { useBoard, type Board, type BoardColumn, type Card, type CardType } from "../../state";
import { adjacentColumnId, applyMoves, resolveMove, type BoardMove } from "./move";

export type { BoardMove } from "./move";

export interface BoardProps {
  /** Invoked when a card moves between columns, for consumers to persist. */
  onMoveCard?: (move: BoardMove) => void;
}

const TYPE_LABEL: Record<CardType, string> = {
  issue: "Issue",
  pull: "PR",
  local: "Local",
};

/**
 * Kanban board: ordered columns over the unified card projection. Supports
 * pointer drag (dnd-kit) and a keyboard/single-pointer alternative (move
 * left/right controls), so a drag gesture is never required (WCAG 2.2 AA).
 *
 * The board is read-only: it renders cards and reports moves via `onMoveCard`;
 * it never writes to GitHub or the local store itself.
 */
export function Board({ onMoveCard }: BoardProps) {
  const { data, isPending, isError } = useBoard();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [moves, setMoves] = useState<Record<string, string>>({});

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

  function handleMove(cardId: string, toColumnId: string) {
    const move = resolveMove(effective, cardId, toColumnId);
    if (!move) return;
    setMoves((previous) => ({ ...previous, [cardId]: toColumnId }));
    onMoveCard?.(move);
  }

  function handleDragEnd(event: DragEndEvent) {
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="p-4 md:px-6" role="region" aria-label="Kanban board">
        {totalCards === 0 ? <EmptyState /> : null}
        <div className="flex gap-3 overflow-x-auto pb-2">
          {effective.columns.map((column) => (
            <BoardColumn key={column.id} column={column} onMoveRelative={handleMoveRelative} />
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function BoardColumn({
  column,
  onMoveRelative,
}: {
  column: BoardColumn;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

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
        <span className="min-w-6 rounded-full bg-muted px-2 py-0.5 text-center text-xs tabular-nums text-muted-foreground">
          {column.cards.length}
        </span>
      </header>
      <ul className="flex flex-1 flex-col gap-2">
        {column.cards.map((card) => (
          <BoardCard key={card.id} card={card} onMoveRelative={onMoveRelative} />
        ))}
      </ul>
    </section>
  );
}

function BoardCard({
  card,
  onMoveRelative,
}: {
  card: Card;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-elevated p-3 text-card-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20",
        isDragging && "opacity-60 shadow-lg",
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
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                card.source === "local"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {TYPE_LABEL[card.type]}
            </span>
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
    </li>
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
