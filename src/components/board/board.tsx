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
  GripVertical,
  Inbox,
  MoveLeft,
  MoveRight,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { MAX_WIP_PER_COLUMN } from "../../lib/config";
import { SPRING_CARD_FLIGHT, SPRING_GHOST_LIFT } from "../../lib/motion";
import { useBoard, type Board, type BoardColumn as BoardColumnType, type Card } from "../../state";
import { Badge } from "../ui/badge";
import { CardMetaRow } from "../ui/card-meta";
import { MoveToast, type MoveToastState } from "./move-toast";
import { adjacentColumnId, applyMoves, resolveMove, type BoardMove } from "./move";

export type { BoardMove } from "./move";

export interface BoardProps {
  /** Invoked when a card moves between columns, for consumers to persist. */
  onMoveCard?: (move: BoardMove) => void;
}

/** DragOverlay ghost lift relative to its resting size (≤ ~1.03 keeps text crisp). */
const GHOST_SCALE = 1.03;
/** Slight ghost tilt in degrees — reads as "picked up", never cartoonish. */
const GHOST_TILT_DEG = 1.5;
/** How long the landing accent-ring pulse fades out (~300ms per round 3 spec). */
const LANDING_PULSE_MS = 300;
/** Mid-flight scale dip duration: content settles from slightly small onto landing. */
const FLIGHT_DIP_MS = 300;
const FLIGHT_DIP_KEYFRAMES = [0.96, 1];

/**
 * Kanban board: ordered columns over the unified card projection. Supports
 * pointer drag (dnd-kit) and a keyboard/single-pointer alternative (move
 * left/right controls), so a drag gesture is never required (WCAG 2.2 AA).
 *
 * UX overhaul:
 * - Full viewport height constraint with isolated per-column scrolling.
 * - Progressive disclosure: drag handle and move arrows are hidden at rest,
 *   smoothly revealed on card hover or focus-within to eliminate visual clutter.
 * - Accurate ghost card sizing (w-72 matching column width).
 * - Per-column empty states and accessible WIP warning indicators.
 * - Motion tuned with centralized spring dynamics.
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
  const [toast, setToast] = useState<MoveToastState | null>(null);
  const [pulse, setPulse] = useState<{ columnId: string; key: number } | null>(null);
  const [flight, setFlight] = useState<{ cardId: string; key: number } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  // Landing feedback timers: the accent ring (~300ms fade) and the mid-flight
  // scale dip both self-clear — nodes unmount, nothing lingers in the DOM.
  useEffect(() => {
    if (!pulse && !flight) return;
    const timer = setTimeout(
      () => {
        setPulse(null);
        setFlight(null);
      },
      Math.max(LANDING_PULSE_MS, FLIGHT_DIP_MS) + 50,
    );
    return () => clearTimeout(timer);
  }, [pulse, flight]);

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
    if (!reduceMotion && move.toColumnId !== move.fromColumnId) {
      const key = Date.now();
      setPulse({ columnId: move.toColumnId, key });
      // Owned at Board level on purpose: the moving card unmounts from its
      // old column and mounts into the new one, so per-card refs would reset
      // and never detect the crossing.
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

  function handleMoveRelative(cardId: string, delta: -1 | 1) {
    const card = findCard(effective, cardId);
    if (!card) return;
    const currentColumnId = moves[cardId] ?? card.columnId;
    const target = adjacentColumnId(effective.columns, currentColumnId, delta);
    if (target) handleMove(cardId, target);
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
            {effective.columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                pulse={pulse}
                flight={flight}
                onMoveRelative={handleMoveRelative}
                reduceMotion={reduceMotion}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={reduceMotion ? null : undefined}>
            {activeCard ? <GhostCard card={activeCard} reduceMotion={reduceMotion} /> : null}
          </DragOverlay>
        </LayoutGroup>
      </div>
      <MoveToast toast={toast} onUndo={handleUndo} onDismiss={dismissToast} />
    </DndContext>
  );
}

function BoardColumn({
  column,
  pulse,
  flight,
  onMoveRelative,
  reduceMotion,
}: {
  column: BoardColumnType;
  pulse: { columnId: string; key: number } | null;
  flight: { cardId: string; key: number } | null;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
  reduceMotion: boolean;
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
        "relative flex h-full max-h-full w-72 shrink-0 flex-col rounded-xl border bg-card p-2 transition-colors duration-150",
        isOver && "border-primary/60 bg-primary/5 ring-1 ring-primary/30",
      )}
    >
      {pulse != null && pulse.columnId === column.id && !reduceMotion && (
        // Landing accent pulse (~300ms fade). Mount-only animation: the node
        // unmounts when the timer clears it — no lingering exit in the DOM.
        <motion.div
          key={pulse.key}
          aria-hidden="true"
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 0 }}
          transition={{ duration: LANDING_PULSE_MS / 1000, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 z-10 rounded-xl ring-2 ring-primary/60"
        />
      )}
      <header className="flex items-center justify-between px-2 py-1.5">
        <h2 className="text-sm font-medium tracking-tight">{column.title}</h2>
        <span
          title={overWip ? `More than ${MAX_WIP_PER_COLUMN} cards in this column` : undefined}
          className={cn(
            "inline-flex items-center gap-1 min-w-6 rounded-full px-2 py-0.5 text-center text-xs tabular-nums",
            overWip
              ? "border border-warning/30 bg-warning/10 text-warning"
              : "bg-muted text-muted-foreground",
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
      <ul className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto pr-0.5 no-scrollbar">
        {column.cards.length === 0 ? (
          <li className="flex items-center justify-center rounded-lg border border-dashed py-8">
            <span className="text-xs text-muted-foreground">No cards</span>
          </li>
        ) : (
          column.cards.map((card) => (
            <BoardCard
              key={card.id}
              card={card}
              dipping={flight?.cardId === card.id}
              onMoveRelative={onMoveRelative}
              reduceMotion={reduceMotion}
            />
          ))
        )}
      </ul>
    </section>
  );
}

function BoardCard({
  card,
  dipping,
  onMoveRelative,
  reduceMotion,
}: {
  card: Card;
  /** True while this card is mid-flight to another column (Board-owned). */
  dipping: boolean;
  onMoveRelative: (cardId: string, delta: -1 | 1) => void;
  reduceMotion: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    // Shared layoutId lets framer-motion fly the card between columns with a
    // tuned spring; reduced-motion users get an instant swap instead.
    <motion.li
      ref={setNodeRef}
      layoutId={reduceMotion ? undefined : card.id}
      transition={reduceMotion ? { duration: 0 } : SPRING_CARD_FLIGHT}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "group rounded-lg border bg-elevated p-3 text-card-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20",
        isDragging && "opacity-40 shadow-lg",
      )}
    >
      <motion.div
        // `flight` only exists when reduced motion is off (Board gates it),
        // so a true `dipping` here always means "play the dip".
        animate={dipping ? { scale: FLIGHT_DIP_KEYFRAMES } : { scale: 1 }}
        transition={SPRING_CARD_FLIGHT}
        style={{ transformOrigin: "center top" }}
      >
        <div className="flex items-start gap-2">
          <button
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            type="button"
            aria-label={`Drag ${card.title}`}
            className="mt-0.5 shrink-0 cursor-grab rounded text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 hover:text-foreground active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-snug" title={card.title}>
              {card.title}
            </p>
            <div className="mt-2 flex w-full items-center gap-2">
              <CardMetaRow card={card} />
            </div>
            {card.labels.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {card.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1 border-t pt-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
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
      </motion.div>
    </motion.li>
  );
}

/**
 * Lifted ghost that follows the cursor during a drag (non-interactive). It
 * lifts to ~1.03x with an elevation-3 shadow and a slight tilt so it reads as
 * physically picked up; reduced-motion users get a static ghost.
 */
function GhostCard({ card, reduceMotion }: { card: Card; reduceMotion: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={reduceMotion ? false : { scale: 1, rotate: 0 }}
      animate={{
        scale: reduceMotion ? 1 : GHOST_SCALE,
        rotate: reduceMotion ? 0 : GHOST_TILT_DEG,
      }}
      transition={reduceMotion ? { duration: 0 } : SPRING_GHOST_LIFT}
      className="w-72 cursor-grabbing rounded-lg border bg-elevated p-3 text-card-foreground shadow-lg ring-1 ring-primary/30"
    >
      <p className="truncate text-sm font-medium leading-snug">{card.title}</p>
      <div className="mt-2 flex w-full items-center gap-2">
        <CardMetaRow card={card} />
      </div>
      {card.labels.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {card.labels.map((label) => (
            <Badge key={label} variant="outline">
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
