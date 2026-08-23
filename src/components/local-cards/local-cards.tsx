"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import type { LocalItem } from "../../data/types";
import type { LocalStatus } from "../../domain/columns";
import { localStatusStrategy } from "../../domain/columns";
import { cn } from "../../lib/utils";
import { useLocalCards } from "../../state";
import { Badge } from "../ui/badge";
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

interface LocalCardsProps {
  onClose?: () => void;
}

/**
 * Modern Local Cards side panel.
 *
 * Provides a dedicated, glassmorphic sidebar feed for managing local-only tasks,
 * featuring column status filtering, rich card previews, quick inline editing,
 * and 1-click launch of the modal creator.
 */
export function LocalCards({ onClose }: LocalCardsProps) {
  const { list, update, remove } = useLocalCards();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<"all" | LocalStatus>("all");

  const cards = list.data ?? [];

  const counts = useMemo(() => {
    return {
      all: cards.length,
      todo: cards.filter((c) => statusForColumn(c.column_id) === "todo").length,
      doing: cards.filter((c) => statusForColumn(c.column_id) === "doing").length,
      done: cards.filter((c) => statusForColumn(c.column_id) === "done").length,
    };
  }, [cards]);

  const filteredCards = useMemo(() => {
    if (selectedFilter === "all") return cards;
    return cards.filter((c) => statusForColumn(c.column_id) === selectedFilter);
  }, [cards, selectedFilter]);

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
    <section
      className="flex h-full flex-col overflow-hidden bg-card/30"
      role="region"
      aria-label="Local cards"
    >
      <CreateCardModal />

      {/* Header bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3 bg-card/60 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs ring-1 ring-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Local Cards
            </h2>
            <p className="text-[10px] text-muted-foreground">
              Offline &bull; Browser storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
            {cards.length}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close local cards panel"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Actions & Filters */}
      <div className="shrink-0 border-b border-border/50 p-3 bg-card/40 flex flex-col gap-2.5">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleOpenModal}
          aria-label="New local card"
          className="w-full justify-center gap-2 rounded-xl py-2 text-xs font-semibold shadow-xs shadow-primary/10"
        >
          <Plus className="h-4 w-4" />
          New local card
        </Button>

        {/* Filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {(
            [
              { id: "all", label: "All", count: counts.all },
              { id: "todo", label: "To Do", count: counts.todo },
              { id: "doing", label: "Doing", count: counts.doing },
              { id: "done", label: "Done", count: counts.done },
            ] as const
          ).map((tab) => {
            const isSelected = selectedFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedFilter(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded px-1 text-[9px] font-mono",
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
        {filteredCards.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-4 text-center">
            <Sparkles className="h-5 w-5 text-muted-foreground/50 mb-2" />
            <p className="text-xs font-semibold text-foreground">
              {cards.length === 0 ? "No local cards yet" : "No cards in this column"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
              {cards.length === 0
                ? "Create offline tasks that persist in your browser."
                : "Switch filter to view other cards or create a new one."}
            </p>
            {cards.length === 0 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleOpenModal}
                className="mt-3 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add first card
              </Button>
            )}
          </div>
        ) : (
          <ul aria-label="Local card list" className="flex flex-col gap-2">
            {filteredCards.map((card) =>
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
      </div>

      {/* Subtle Footer */}
      <div className="shrink-0 border-t border-border/50 px-3 py-2 bg-card/60 text-[10px] text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          IndexedDB Synced
        </span>
        <span>Independent of Git</span>
      </div>
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
    <li className="group relative flex flex-col gap-2 rounded-xl border border-border/80 bg-background/90 p-3 shadow-xs transition-all duration-150 hover:border-primary/50 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase ${statusColor}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {STATUS_LABEL[status]}
          </span>
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-medium text-primary">
            local
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-90 transition-opacity">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEdit}
            className="h-6 px-2 text-[10px]"
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDelete}
            aria-label="Delete"
            className="h-6 px-2 text-[10px] hover:border-destructive/40 hover:text-destructive"
          >
            Delete
          </Button>
        </div>
      </div>

      <div>
        <p
          className="text-xs font-semibold leading-snug text-foreground break-words"
          title={card.title}
        >
          {card.title}
        </p>
        {card.body && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed font-normal">
            {card.body}
          </p>
        )}
      </div>
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
        className="flex flex-col gap-2.5 rounded-xl border border-primary/60 bg-card p-3.5 shadow-xs ring-1 ring-primary/20"
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Edit card title"
          className="text-xs"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-label="Edit card description"
          rows={2}
          className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-xs text-foreground shadow-xs transition-colors duration-150 placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Select
              aria-label="Edit card status"
              options={STATUS_OPTIONS}
              value={status}
              onValueChange={(next) => setStatus(next as LocalStatus)}
              className="w-24 text-xs h-7"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              className="h-7 text-xs px-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!title.trim()}
              className="h-7 text-xs px-2.5"
            >
              Save changes
            </Button>
          </div>
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
    <div className="flex h-full flex-col p-4" role="status" aria-label="Loading local cards">
      <div className="mb-3 h-4 w-20 animate-pulse rounded bg-muted" />
      <div className="mb-4 h-9 w-full animate-pulse rounded-xl bg-muted/70" />
      <div className="space-y-2">
        <div className="h-16 w-full animate-pulse rounded-xl bg-muted/50" />
        <div className="h-16 w-full animate-pulse rounded-xl bg-muted/50" />
      </div>
    </div>
  );
}
