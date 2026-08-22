"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  CircleDot,
  Copy,
  ExternalLink,
  GitPullRequest,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { formatState } from "../ui/card-meta";
import { Select } from "../ui/select";
import { formatRelativeShort } from "../../lib/relative-date";
import type { Card } from "../../state/cards";

export interface ColumnOption {
  id: string;
  title: string;
}

export interface CardPreviewDrawerProps {
  card: Card | null;
  onClose: () => void;
  onMoveColumn?: (cardId: string, targetColumnId: string) => void;
  columns?: ColumnOption[];
}

const DEFAULT_COLUMNS: ColumnOption[] = [
  { id: "todo", title: "To Do" },
  { id: "doing", title: "Doing" },
  { id: "in-review", title: "In Review" },
  { id: "draft", title: "Draft" },
  { id: "backlog", title: "Backlog" },
  { id: "done", title: "Done" },
];

export function CardPreviewDrawer({
  card,
  onClose,
  onMoveColumn,
  columns = DEFAULT_COLUMNS,
}: CardPreviewDrawerProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (card) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [card, onClose]);

  function handleCopyReference() {
    if (!card) return;
    const text =
      card.source === "github" && card.number != null
        ? `#${card.number} ${card.title}`
        : card.title;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const columnOptions = columns.map((col) => ({
    value: col.id,
    label: col.title,
  }));

  const isOpen = card?.state === "open";
  const kindLabel =
    card?.type === "pull" ? "Pull Request" : card?.type === "issue" ? "Issue" : "Local Card";
  const KindIcon = card?.type === "pull" ? GitPullRequest : CircleDot;

  return (
    <AnimatePresence>
      {card && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Card details">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Slide-over Drawer */}
          <motion.aside
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl md:max-w-2xl"
          >
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  <KindIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {kindLabel}
                </span>

                {card.number != null && (
                  <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                    #{card.number}
                  </span>
                )}

                {card.state != null && (
                  <Badge variant={isOpen ? "success" : "neutral"} className="text-[11px]">
                    {formatState(card.state)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyReference}
                  title="Copy reference"
                  aria-label="Copy reference"
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                      <span className="ml-1 text-success">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="ml-1">Copy</span>
                    </>
                  )}
                </Button>

                {card.htmlUrl && (
                  <a
                    href={card.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    title="Open on GitHub"
                    aria-label="Open on GitHub"
                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close preview (Esc)"
                  title="Close (Esc)"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6">
              {/* Header Title */}
              <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                {card.title}
              </h2>

              {/* Status & Placement Grid */}
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">Column:</span>
                  {onMoveColumn ? (
                    <Select
                      aria-label="Change column"
                      options={columnOptions}
                      value={card.columnId}
                      onValueChange={(next) => onMoveColumn(card.id, next)}
                      className="w-32"
                    />
                  ) : (
                    <Badge variant="accent" className="font-mono">
                      {columns.find((c) => c.id === card.columnId)?.title ?? card.columnId}
                    </Badge>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-3 font-mono text-[11px] tabular-nums">
                  {card.updatedAt && (
                    <span title={new Date(card.updatedAt).toLocaleString()}>
                      Updated {formatRelativeShort(card.updatedAt)} ago
                    </span>
                  )}
                </div>
              </div>

              {/* Labels Section */}
              {card.labels.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Labels
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {card.labels.map((label) => (
                      <li key={label}>
                        <Badge variant="outline" className="border-primary/20 bg-primary/[0.04] text-xs">
                          {label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description Section */}
              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Description
                </h3>
                {card.body && card.body.trim().length > 0 ? (
                  <div className="mt-2.5 rounded-lg border border-border/60 bg-background/50 p-4">
                    <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                      {card.body}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    No description provided for this item.
                  </p>
                )}
              </div>

              {/* Linked PRs Section */}
              {card.linkedPrs && card.linkedPrs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Linked Pull Requests
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {card.linkedPrs.map((prNumber) => {
                      const prUrl = card.htmlUrl
                        ? card.htmlUrl.replace(/\/issues\/\d+$/, "").replace(/\/pull\/\d+$/, "") + `/pull/${prNumber}`
                        : null;

                      return (
                        <li key={prNumber}>
                          {prUrl ? (
                            <a
                              href={prUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2.5 py-1 font-mono text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                            >
                              <GitPullRequest className="h-3 w-3 text-primary" aria-hidden="true" />
                              <span>#{prNumber}</span>
                              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
                              <GitPullRequest className="h-3 w-3" aria-hidden="true" />
                              <span>#{prNumber}</span>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Bottom Footer Action Bar */}
            <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
              <span className="font-mono">Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Esc</kbd> to close</span>
              {card.htmlUrl && (
                <a
                  href={card.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline hover:underline-offset-4"
                >
                  View full thread on GitHub
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
