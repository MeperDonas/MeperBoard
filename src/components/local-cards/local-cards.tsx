"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import type { LocalItem } from "../../data/types";
import type { LocalStatus } from "../../domain/columns";
import { localStatusStrategy } from "../../domain/columns";
import { useLocalCards } from "../../state";

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
    return <LocalCardsStatus>Loading local cards…</LocalCardsStatus>;
  }
  if (list.isError) {
    return <LocalCardsStatus>Failed to load local cards.</LocalCardsStatus>;
  }

  return (
    <section className="p-4" role="region" aria-label="Local cards">
      <h2 className="mb-3 text-sm font-semibold">Local cards</h2>

      <form
        onSubmit={handleSubmit}
        aria-label="New local card"
        className="mb-4 flex flex-col gap-2 rounded-md border bg-card p-3"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Card title"
          aria-label="New card title"
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Description (optional)"
          aria-label="New card description"
          rows={2}
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as LocalStatus)}
              aria-label="New card status"
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!title.trim() || create.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors disabled:opacity-50"
          >
            Add card
          </button>
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
    <li className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5">
      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
        Local
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{card.title}</p>
        <span className="text-xs text-muted-foreground">
          {STATUS_LABEL[statusForColumn(card.column_id)]}
        </span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded-md border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted"
      >
        Edit
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="rounded-md border px-2 py-1 text-xs text-foreground transition-colors hover:bg-muted hover:text-destructive"
      >
        Delete
      </button>
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
        className="flex flex-col gap-2 rounded-md border border-primary bg-card p-3"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Edit card title"
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Edit card description"
          rows={2}
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm text-foreground"
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as LocalStatus)}
              aria-label="Edit card status"
              className="rounded-md border bg-background px-2 py-1 text-sm text-foreground"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
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
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}
