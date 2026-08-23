"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import type { LocalItem } from "../../data/types";
import type { LocalStatus } from "../../domain/columns";
import { localStatusStrategy } from "../../domain/columns";
import { useLocalCards } from "../../state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { CreateCardModal, OPEN_CREATE_LOCAL_CARD_EVENT } from "./create-card-modal";

const STATUS_OPTIONS: { value: LocalStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const STATUS_LABEL: Record<LocalStatus, string> = {
  todo: "To Do",
  doing: "Doing",
  done: "Done",
};

/**
 * Local-card management (spec local-cards): create, edit, and delete cards in
 * the local store, fully independent of GitHub. Cards map to columns via the
 * `local-status` strategy; a GitHub sync never touches them.
 *
 * Creation opens exclusively via the dedicated `CreateCardModal` dialog.
 */
export function LocalCards() {
  const { list, update, remove } = useLocalCards();
  const [editingId, setEditingId] = useState<string | null>(null);

  const cards = list.data ?? [];

  function handleSave(id: string, next: LocalItem) {
    update.mutate({ id, patch: next });
    setEditingId(null);
  }

  function handleOpenModal() {
    window.dispatchEvent(new CustomEvent(OPEN_CREATE_LOCAL_CARD_EVENT));
  }

  if (list.isPending) {
    return <LocalCardsSkeleton />;
  }
  if (list.isError) {
    return <LocalCardsStatus>Failed to load local cards.</LocalCardsStatus>;
  }

  return (
    <section className="p-4 md:px-6 lg:pl-0" role="region" aria-label="Local cards">
      <CreateCardModal />

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          Local cards
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
          {cards.length} {cards.length === 1 ? "card" : "cards"}
        </span>
      </div>

      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handleOpenModal}
        aria-label="New local card"
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold shadow-xs"
      >
        <Plus className="h-4 w-4" />
        New local card
      </Button>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-6 text-center">
          <Sparkles className="h-5 w-5 text-muted-foreground/60 mb-2" />
          <p className="text-xs font-medium text-foreground">No local cards yet</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Create tasks and notes stored offline in your browser.
          </p>
        </div>
      ) : (
        <ul aria-label="Local card list" className="flex flex-col gap-2">
          {cards.map((card) =>
            editingId === card.id ? (
              <LocalCardEditForm
                key={card.id}
                card={card}
                onSave={(next) => handleSave(card.id, next)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <LocalCardRow
                key={card.id}
                card={card}
                onEdit={() => setEditingId(card.id)}
                onDelete={() => remove.mutate(card.id)}
              />
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function LocalCardRow({
  card,
  onEdit,
  onDelete,
}: {
  card: LocalItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = statusForColumn(card.column_id);
  const statusColor =
    status === "done"
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : status === "doing"
        ? "text-blue-500 bg-blue-500/10 border-blue-500/20"
        : "text-amber-500 bg-amber-500/10 border-amber-500/20";

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-xs transition-colors duration-150 hover:border-primary/40">
      <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
        Local
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-snug text-foreground" title={card.title}>
          {card.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[9px] font-medium ${statusColor}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onEdit}
        className="h-7 px-2.5 text-xs"
      >
        Edit
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onDelete}
        aria-label="Delete"
        className="h-7 px-2.5 text-xs hover:border-destructive/40 hover:text-destructive"
      >
        Delete
      </Button>
    </li>
  );
}

function LocalCardEditForm({
  card,
  onSave,
  onCancel,
}: {
  card: LocalItem;
  onSave: (next: LocalItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [status, setStatus] = useState<LocalStatus>(statusForColumn(card.column_id));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      ...card,
      title: trimmed,
      body: body.trim(),
      column_id: localStatusStrategy.columnFor(status),
    });
  }

  return (
    <li>
      <form
        onSubmit={handleSubmit}
        aria-label={`Edit card ${card.title}`}
        className="flex flex-col gap-2.5 rounded-xl border border-primary/60 bg-card p-4 shadow-xs ring-1 ring-primary/20"
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Edit card title"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Edit card description"
          rows={2}
          className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Status
            <Select
              aria-label="Edit card status"
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={(next) => setStatus(next as LocalStatus)}
              className="w-28"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!title.trim()}
          >
            Save changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </li>
  );
}

/** Map a local card's stored column back to a status for the status selector. */
function statusForColumn(columnId: string): LocalStatus {
  if (columnId === "doing") return "doing";
  if (columnId === "done") return "done";
  return "todo";
}

function LocalCardsStatus({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground md:px-6">{children}</p>;
}

/** Form-shaped placeholders while the local-card query resolves. */
function LocalCardsSkeleton() {
  return (
    <div className="p-4 md:px-6 lg:pl-0" role="status" aria-label="Loading local cards">
      <div className="mb-3 h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="mb-4 h-9 w-full animate-pulse rounded-xl bg-muted/70" />
    </div>
  );
}
