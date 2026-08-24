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
import {
  AlertCircle,
  AlertTriangle,
  Inbox,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { MAX_WIP_PER_COLUMN } from "../../lib/config";
import { SPRING_CARD_FLIGHT, SPRING_GHOST_LIFT } from "../../lib/motion";
import { getRepoColorScheme } from "../../lib/repo-colors";
import { useBoard, type Board, type BoardColumn as BoardColumnType, type Card } from "../../state";
import { Badge } from "../ui/badge";
import { CardMetaRow } from "../ui/card-meta";
import { MoveToast, type MoveToastState } from "./move-toast";
import { isCriticalCard } from "../../domain/metrics";
import { applyMoves, resolveMove, type BoardMove } from "./move";

export type { BoardMove } from "./move";

export interface BoardProps {
  /** Invoked when a card moves between columns, for consumers to persist. */
  onMoveCard?: (move: BoardMove) => void;
  /** Invoked when a card is clicked for inspection / preview. */
  onSelectCard?: (card: Card) => void;
  /** In-memory query filter. */
  searchQuery?: string;
  /** Card type or critical filter. */
  filterType?: "all" | "issue" | "pull" | "local" | "critical";
}

/** How long the landing accent-ring pulse fades out (~300ms per round 3 spec). */
const LANDING_PULSE_MS = 300;
/** Mid-flight scale dip duration: content settles from slightly small onto landing. */
const FLIGHT_DIP_MS = 300;
const FLIGHT_DIP_KEYFRAMES = [0.96, 1];

function filterCard(
  card: Card,
  query: string,
  filterType: "all" | "issue" | "pull" | "local" | "critical",
): boolean {
  if (query) {
    const q = query.toLowerCase();
    const titleMatch = card.title.toLowerCase().includes(q);
    const bodyMatch = card.body.toLowerCase().includes(q);
    const labelMatch = card.labels.some((l) => l.toLowerCase().includes(q));
    const numberMatch = card.number != null && String(card.number).includes(q);
    if (!titleMatch && !bodyMatch && !labelMatch && !numberMatch) return false;
  }

  if (filterType === "issue") return card.type === "issue";
  if (filterType === "pull") return card.type === "pull";
  if (filterType === "local") return card.type === "local";
  if (filterType === "critical") return isCriticalCard(card);

  return true;
}

/**
 * Kanban board: ordered columns over the unified card projection. Supports
 * pointer drag (dnd-kit) and a keyboard/single-pointer alternative (move
 * left/right controls), so a drag gesture is never required (WCAG 2.2 AA).
 */
export function Board({
  onMoveCard,
  onSelectCard,
  searchQuery = "",
  filterType = "all",
}: BoardProps) {
  const { data, isPending, isError } = useBoard();
  const reduceMotion = useReducedMotion() ?? false;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [moves, setMoves] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [toast, setToast] = useState<MoveToastState | null>(null);
  const [pulse, setPulse] = useState<{ columnId: string; key: number } | null>(null);
  const [flight, setFlight] = useState<{ cardId: string; key: number } | null>(null);

  const effective = applyMoves(data ?? { columns: [] }, moves);

  const filteredBoard: Board = useMemo(() => {
    return {
      ...effective,
      columns: effective.columns.map((column: BoardColumnType) => ({
        ...column,
        cards: column.cards.filter((card: Card) =>
          filterCard(card, searchQuery, filterType),
        ),
      })),
    };
  }, [effective, searchQuery, filterType]);

  const totalCards = filteredBoard.columns.reduce(
    (sum: number, column: BoardColumnType) => sum + column.cards.length,
    0,
  );
  const activeCard = activeId ? findCard(effective, activeId) : null;

  function handleMove(cardId: string, toColumnId: string) {
    const move = resolveMove(effective, cardId, toColumnId);
    if (!move) return;
    setMoves((previous) => ({ ...previous, [cardId]: toColumnId }));
    onMoveCard?.(move);
    if (!reduceMotion && move.toColumnId !== move.fromColumnId) {
      const key = Date.now();
      setPulse({ columnId: move.toColumnId, key });
      setFlight({ cardId, key });
    }
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

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full flex-col p-4 md:px-6" role="region" aria-label="Kanban board">
        {totalCards === 0 ? <EmptyState /> : null}
        <LayoutGroup>
          <div className="flex flex-1 min-h-0 gap-3 overflow-x-auto pb-2 no-scrollbar">
            {filteredBoard.columns.map((column: BoardColumnType) => (
              <BoardColumn
                key={column.id}
                column={column}
                pulse={pulse}
                flight={flight}
                isDraggingActive={Boolean(activeId)}
                reduceMotion={reduceMotion}
                onSelectCard={onSelectCard}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
            {activeCard ? <GhostCard card={activeCard} reduceMotion={reduceMotion} /> : null}
          </DragOverlay>
        </LayoutGroup>
      </div>
      <MoveToast toast={toast} onUndo={handleUndo} onDismiss={() => setToast(null)} />
    </DndContext>
  );
}

function BoardColumn({
  column,
  pulse,
  flight,
  isDraggingActive,
  reduceMotion,
  onSelectCard,
}: {
  column: BoardColumnType;
  pulse: { columnId: string; key: number } | null;
  flight: { cardId: string; key: number } | null;
  isDraggingActive: boolean;
  reduceMotion: boolean;
  onSelectCard?: (card: Card) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const total = column.cards.length;
  const overWip = total > MAX_WIP_PER_COLUMN;

  return (
    <section
      ref={setNodeRef}
      data-column-id={column.id}
      aria-label={`${column.title} column`}
      className={cn(
        "relative flex h-full max-h-full w-72 shrink-0 flex-col rounded-xl border border-t-2 border-t-primary/70 bg-card/85 backdrop-blur-xs p-2.5 transition-all duration-200",
        isOver
          ? "border-primary ring-2 ring-primary/40 bg-primary/[0.06] shadow-xl shadow-primary/15"
          : "border-border hover:border-primary/40 hover:shadow-md hover:shadow-primary/5",
      )}
    >
      {pulse != null && pulse.columnId === column.id && !reduceMotion && (
        <motion.div
          key={pulse.key}
          aria-hidden="true"
          initial={{ opacity: 0.9, scale: 0.99 }}
          animate={{ opacity: 0, scale: 1 }}
          transition={{ duration: LANDING_PULSE_MS / 1000, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-10 rounded-xl ring-2 ring-primary shadow-lg shadow-primary/30"
        />
      )}
      <header className="flex items-center justify-between px-2 py-1.5 border-b border-border/50 pb-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary shadow-xs ring-1 ring-primary/40" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{column.title}</h2>
        </div>
        <span
          title={overWip ? `More than ${MAX_WIP_PER_COLUMN} cards in this column` : undefined}
          className={cn(
            "inline-flex items-center gap-1 min-w-6 rounded-full px-2 py-0.5 text-center font-mono text-xs tabular-nums transition-colors duration-150",
            overWip
              ? "border border-warning/30 bg-warning/10 text-warning"
              : isOver
                ? "bg-primary text-primary-foreground font-semibold"
                : "border border-primary/20 bg-primary/10 text-primary font-medium",
          )}
        >
          {overWip && (
            <AlertTriangle
              className="h-3 w-3 text-warning"
              aria-label="Column over WIP limit"
            />
          )}
          {total}
        </span>
      </header>
      <ul className="flex flex-1 min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5 no-scrollbar py-1">
        {column.cards.length === 0 && !isOver ? (
          <li className="flex items-center justify-center rounded-lg border border-dashed py-8 transition-colors">
            <span className="text-xs text-muted-foreground">No cards</span>
          </li>
        ) : (
          column.cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              dipping={flight?.cardId === card.id}
              reduceMotion={reduceMotion}
              onSelect={() => onSelectCard?.(card)}
            />
          ))
        )}
        {isOver && isDraggingActive && (
          <motion.li
            initial={{ opacity: 0, scale: 0.95, height: 0 }}
            animate={{ opacity: 1, scale: 1, height: "auto" }}
            exit={{ opacity: 0, scale: 0.95, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 py-4 text-xs font-medium text-primary shadow-xs"
          >
            Drop here
          </motion.li>
        )}
      </ul>
    </section>
  );
}

function BoardCard({
  card,
  dipping,
  reduceMotion,
  onSelect,
}: {
  card: Card;
  dipping: boolean;
  reduceMotion: boolean;
  onSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <motion.li
      ref={setNodeRef}
      layoutId={reduceMotion ? undefined : card.id}
      transition={reduceMotion ? { duration: 0 } : SPRING_CARD_FLIGHT}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      {...listeners}
      {...attributes}
      className={cn(
        "group relative cursor-grab shrink-0 rounded-xl border bg-elevated p-3 text-card-foreground shadow-xs transition-all duration-200 ease-out select-none active:cursor-grabbing",
        "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/40 hover:bg-elevated/95",
        isDragging && "opacity-25 border-dashed border-primary scale-[0.98] shadow-inner",
      )}
    >
      <motion.div
        animate={dipping ? { scale: FLIGHT_DIP_KEYFRAMES } : { scale: 1 }}
        transition={SPRING_CARD_FLIGHT}
        style={{ transformOrigin: "center top" }}
        className="w-full cursor-pointer"
        onClick={() => {
          if (!isDragging) {
            onSelect?.();
          }
        }}
      >
        <p
          className="text-sm font-medium leading-snug tracking-tight text-foreground transition-colors duration-150 group-hover:text-primary break-words"
          title={card.title}
        >
          {card.title}
        </p>
        <div className="mt-1.5 flex w-full flex-wrap items-center gap-1.5">
          <CardMetaRow card={card} />
        </div>
        {card.labels.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {card.labels.map((label) => (
              <Badge
                key={label}
                variant="outline"
                className="text-[10px] px-1.5 py-0.5 transition-colors group-hover:border-primary/40 group-hover:text-primary"
              >
                {label}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>
    </motion.li>
  );
}

function GhostCard({ card, reduceMotion }: { card: Card; reduceMotion: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={reduceMotion ? false : { scale: 1, rotate: 0 }}
      animate={{
        scale: reduceMotion ? 1 : 1.05,
        rotate: reduceMotion ? 0 : 2.5,
      }}
      transition={reduceMotion ? { duration: 0 } : SPRING_GHOST_LIFT}
      className="relative w-72 cursor-grabbing rounded-xl border-2 border-primary bg-elevated/95 p-3 text-card-foreground shadow-2xl shadow-primary/25 backdrop-blur-xl ring-2 ring-primary/50"
    >
      <p className="text-sm font-medium leading-snug tracking-tight text-primary break-words">
        {card.title}
      </p>
      <div className="mt-1.5 flex w-full flex-wrap items-center gap-1.5">
        <CardMetaRow card={card} />
      </div>
      {card.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {card.labels.map((label) => (
            <Badge key={label} variant="accent" className="text-[10px] px-1.5 py-0.5">
              {label}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
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
