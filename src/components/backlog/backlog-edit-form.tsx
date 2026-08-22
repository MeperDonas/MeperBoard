import { useState, type FormEvent } from "react";
import { localStatusStrategy, type LocalStatus } from "../../domain/columns";
import type { Card } from "../../state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

export const STATUS_OPTIONS: { value: LocalStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

export interface BacklogLocalCardPatch {
  title: string;
  body: string;
  columnId: string;
}

/** Map a local card's stored column back to its status (as in LocalCards). */
export function statusForColumn(columnId: string): LocalStatus {
  if (columnId === "doing") return "doing";
  if (columnId === "done") return "done";
  return "todo";
}

export interface BacklogEditFormProps {
  card: Card;
  onCancel: () => void;
  onSave: (patch: BacklogLocalCardPatch) => void;
}

/** Inline editor mirroring LocalCards' edit form, compacted for a row. */
export function BacklogEditForm({ card, onCancel, onSave }: BacklogEditFormProps) {
  const [title, setTitle] = useState(card.title);
  const [body, setBody] = useState(card.body);
  const [status, setStatus] = useState<LocalStatus>(statusForColumn(card.columnId));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      body: body.trim(),
      columnId: localStatusStrategy.columnFor(status),
    });
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`Edit card ${card.title}`} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Edit card title"
          className="flex-1"
        />
        <div className="shrink-0">
          <Select
            aria-label="Edit card status"
            size="sm"
            options={STATUS_OPTIONS}
            value={status}
            onValueChange={(next) => setStatus(next as LocalStatus)}
            className="w-24"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
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
      </div>
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        aria-label="Edit card description"
        rows={2}
        className="mt-2 w-full rounded-lg border bg-card px-3 py-1.5 text-sm text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </form>
  );
}
