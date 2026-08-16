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
import { GripVertical, MoveLeft, MoveRight } from "lucide-react";
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
    return <BoardStatus>Loading board…</BoardStatus>;
  }
  if (isError || !data) {
    return <BoardStatus>Failed to load the board.</BoardStatus>;
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
      <div className="p-4" role="region" aria-label="Kanban board">
        {totalCards === 0 ? <EmptyState /> : null}
        <div className="flex gap-4 overflow-x-auto">
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
        "flex min-h-48 w-72 shrink-0 flex-col rounded-lg border bg-muted/40 p-2",
        isOver && "border-primary ring-2 ring-primary/30",
      )}
    >
      <header className="flex items-center justify-between px-2 py-1">
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <span className="rounded-full bg-muted px-2 text-xs tabular-nums text-muted-foreground">
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
        "rounded-md border bg-card p-3 text-card-foreground",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          type="button"
          aria-label={`Drag ${card.title}`}
          className="mt-0.5 shrink-0 cursor-grab text-muted-foreground transition-colors hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
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
                className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
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
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoveLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Move ${card.title} right`}
          onClick={() => onMoveRelative(card.id, 1)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MoveRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

function BoardStatus({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}

function EmptyState() {
  return (
    <div className="mb-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      No cards yet. Sync your GitHub issues or add a local card.
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
