"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import type { LocalItem } from "../../data/types";
import type { LocalStatus } from "../../domain/columns";
import { localStatusStrategy } from "../../domain/columns";
import { useLocalCards } from "../../state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

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
 */
export function LocalCards() {
  const { list, create, update, remove } = useLocalCards();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<LocalStatus>("todo");
  const [editingId, setEditingId] = useState<string | null>(null);

  const cards = list.data ?? [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    create.mutate({ title: trimmed, body: body.trim(), status });
    setTitle("");
    setBody("");
    setStatus("todo");
  }

  function handleSave(id: string, next: LocalItem) {
    update.mutate({ id, patch: next });
    setEditingId(null);
  }

  if (list.isPending) {
    return <LocalCardsSkeleton />;
  }
  if (list.isError) {
    return <LocalCardsStatus>Failed to load local cards.</LocalCardsStatus>;
  }

  return (
    <section className="p-4 md:px-6 lg:pl-0" role="region" aria-label="Local cards">
      <h2 className="mb-3 text-sm font-medium tracking-tight">Local cards</h2>

      <form
        onSubmit={handleSubmit}
        aria-label="New local card"
        className="mb-4 flex flex-col gap-2.5 rounded-xl border border-primary/20 bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Card title"
          aria-label="New card title"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Description (optional)"
          aria-label="New card description"
          rows={2}
          className="w-full rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Status
            <Select
              aria-label="New card status"
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
            disabled={!title.trim() || create.isPending}
            loading={create.isPending}
          >
            Add card
          </Button>
        </div>
      </form>

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">No local cards yet.</p>
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
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-xs transition-colors duration-150 hover:border-foreground/20">
      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
        Local
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-snug" title={card.title}>
          {card.title}
        </p>
        <span className="text-xs text-muted-foreground">
          {STATUS_LABEL[statusForColumn(card.column_id)]}
        </span>
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
      <div className="mb-4 flex flex-col gap-2.5 rounded-xl border bg-card p-4">
        <div className="h-9 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-16 animate-pulse rounded-lg bg-muted/70" />
        <div className="h-8 w-40 animate-pulse rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}
