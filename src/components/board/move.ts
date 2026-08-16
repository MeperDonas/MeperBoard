import type { Column } from "../../data/types";
import type { Board, BoardColumn } from "../../state";

/**
 * Pure move logic for the kanban board. Kept side-effect free so the drag-drop
 * and keyboard paths share one source of truth, and so it is unit-testable
 * without jsdom layout (which cannot drive dnd-kit collision detection).
 */

/** A card move between two columns, reported to consumers for persistence. */
export interface BoardMove {
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
}

/**
 * Return the id of the column `delta` positions away from `columnId`, or `null`
 * at the board edges. `columns` must be pre-sorted by `order`.
 */
export function adjacentColumnId(
  columns: readonly Column[],
  columnId: string,
  delta: -1 | 1,
): string | null {
  const index = columns.findIndex((column) => column.id === columnId);
  if (index === -1) return null;
  const target = columns[index + delta];
  return target ? target.id : null;
}

/**
 * Resolve a move of `cardId` into `toColumnId`, or `null` when the move is a
 * no-op (already there), targets an unknown column, or the card is unknown.
 */
export function resolveMove(
  board: Board,
  cardId: string,
  toColumnId: string,
): BoardMove | null {
  if (!board.columns.some((column) => column.id === toColumnId)) return null;

  for (const column of board.columns) {
    const card = column.cards.find((c) => c.id === cardId);
    if (!card) continue;
    if (column.id === toColumnId) return null;
    return { cardId, fromColumnId: column.id, toColumnId };
  }

  return null;
}

/**
 * Apply optimistic column overrides (`cardId -> columnId`) to a board, returning
 * a new board with each card placed into its overridden column. Cards whose
 * override targets an unknown column stay in their original column (never
 * dropped).
 */
export function applyMoves(board: Board, moves: Readonly<Record<string, string>>): Board {
  const overrideKeys = Object.keys(moves);
  if (overrideKeys.length === 0) return board;

  const byId = new Map<string, BoardColumn>();
  for (const column of board.columns) byId.set(column.id, { ...column, cards: [] });

  for (const column of board.columns) {
    for (const card of column.cards) {
      const targetId = moves[card.id] ?? card.columnId;
      const target = byId.get(targetId) ?? byId.get(card.columnId);
      target?.cards.push(card);
    }
  }

  return { columns: [...byId.values()] };
}
