"use client";

import { AppHeader } from "../app-header/app-header";
import { Backlog } from "../backlog";
import { useLocalCards } from "../../state";

/**
 * The backlog page composition: app header + the filterable/sortable backlog.
 * Local-card quick actions are wired here through the existing `useLocalCards`
 * mutations — the backlog itself never talks to the data layer.
 */
export function BacklogPage() {
  const { update, remove } = useLocalCards();

  return (
    <div className="min-h-screen">
      <AppHeader />
      <Backlog
        localActions={{
          onEditLocal: (id, patch) =>
            update.mutate({
              id,
              patch: { title: patch.title, body: patch.body, column_id: patch.columnId },
            }),
          onDeleteLocal: (id) => remove.mutate(id),
        }}
      />
    </div>
  );
}
