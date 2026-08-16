"use client";

import { useMoveCard, useSync } from "../../state";
import { AppHeader } from "../app-header/app-header";
import { Board } from "../board";
import { LocalCards } from "../local-cards";

/**
 * The board page composition: app header, a read-only sync control, the kanban
 * board (with move persistence wired), and the local-card panel. This is where
 * the board's `onMoveCard` report becomes a store write — local cards update
 * their column in place; GitHub items write a `column_overrides` row.
 */
export function BoardWorkspace() {
  const sync = useSync();
  const moveCard = useMoveCard();

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors disabled:opacity-50"
        >
          {sync.isPending ? "Syncing…" : "Sync"}
        </button>
        <span className="text-xs text-muted-foreground" data-testid="sync-status">
          {sync.isError
            ? "Sync failed"
            : sync.isSuccess
              ? `Imported ${sync.data.imported} item${sync.data.imported === 1 ? "" : "s"}`
              : "Not synced yet"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Board onMoveCard={(move) => moveCard.mutate(move)} />
        <LocalCards />
      </div>
    </div>
  );
}
