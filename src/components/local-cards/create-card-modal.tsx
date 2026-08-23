"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  CircleDot,
  Eye,
  PenLine,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import type { LocalStatus } from "../../domain/columns";
import { localStatusStrategy } from "../../domain/columns";
import { cn } from "../../lib/utils";
import { useLocalCards } from "../../state";
import { MarkdownContent } from "../ui/MarkdownContent";
import { Button } from "../ui/button";
import { Portal } from "../ui/portal";
import { Select } from "../ui/select";

export const OPEN_CREATE_LOCAL_CARD_EVENT = "meperboard:open-create-local-card";

interface CreateCardModalProps {
  open?: boolean;
  defaultStatus?: LocalStatus;
  onClose?: () => void;
}

const STATUS_ITEMS: { value: LocalStatus; label: string; color: string; bg: string }[] = [
  { value: "backlog", label: "Backlog", color: "text-slate-500 dark:text-slate-400", bg: "bg-slate-500/10 border-slate-500/30" },
  { value: "todo", label: "To Do", color: "text-amber-500 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  { value: "in-progress", label: "In Progress", color: "text-blue-500 dark:text-blue-400", bg: "bg-blue-500/10 border-blue-500/30" },
  { value: "in-review", label: "In Review", color: "text-purple-500 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  { value: "done", label: "Done", color: "text-emerald-500 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
];

const MODAL_SPRING = { type: "spring", stiffness: 380, damping: 28 } as const;

/**
 * Modern, impressive modal dialog for creating local offline cards.
 *
 * Features:
 * - Glassmorphic backdrop with ambient primary glow.
 * - Interactive status pill selector with color cues.
 * - Tabbed Markdown editor (Write / Preview).
 * - Keyboard shortcuts: `Ctrl+Enter` / `⌘+Enter` to submit, `Esc` to cancel.
 * - Listen for global `OPEN_CREATE_LOCAL_CARD_EVENT` to open from anywhere.
 */
export function CreateCardModal({
  open: controlledOpen,
  defaultStatus = "todo",
  onClose: controlledOnClose,
}: CreateCardModalProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { create } = useLocalCards();

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<LocalStatus>(defaultStatus);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : isOpen;

  function handleClose() {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setIsOpen(false);
    }
  }

  // Listen for the cross-component signal to open the modal
  useEffect(() => {
    function handleOpenEvent(event: Event) {
      const customEvent = event as CustomEvent<{ status?: LocalStatus }>;
      if (customEvent.detail?.status) {
        setStatus(customEvent.detail.status);
      }
      setIsOpen(true);
      setActiveTab("write");
    }
    window.addEventListener(OPEN_CREATE_LOCAL_CARD_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_CREATE_LOCAL_CARD_EVENT, handleOpenEvent);
  }, []);

  // Autofocus title on open and reset state
  useEffect(() => {
    if (open) {
      setTitle("");
      setBody("");
      setStatus(defaultStatus);
      setActiveTab("write");
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [open, defaultStatus]);

  // Window Escape key listener
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || create.isPending) return;

    create.mutate({
      title: trimmedTitle,
      body: body.trim(),
      status,
    });

    handleClose();
  }

  function handleFormKeyDown(event: ReactKeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
  }

  if (!open) return null;

  const activeStatusConfig = STATUS_ITEMS.find((s) => s.value === status) ?? STATUS_ITEMS[0];

  return (
    <Portal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create new local card"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        onKeyDown={handleFormKeyDown}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Modal Card */}
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={MODAL_SPRING}
          className={cn(
            "relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl ring-1 ring-border/50",
            "dark:border-primary/20 dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]",
          )}
        >
          {/* Top ambient color accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  New Local Card
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stored offline in your browser &bull; Independent of GitHub
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            {/* Status Segmented Control */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Initial Column / Status
                </label>
                <div className="text-xs font-medium text-muted-foreground">
                  <Select
                    aria-label="New card status"
                    options={STATUS_ITEMS.map((item) => ({ value: item.value, label: item.label }))}
                    value={status}
                    onValueChange={(next) => setStatus(next as LocalStatus)}
                    className="w-28"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_ITEMS.map((item) => {
                  const isSelected = item.value === status;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setStatus(item.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border py-2 px-3 text-xs font-medium transition-all duration-150",
                        isSelected
                          ? cn("border-primary bg-primary/10 text-foreground ring-1 ring-primary/40 shadow-xs font-semibold", item.bg)
                          : "border-border/70 bg-card/60 text-muted-foreground hover:border-foreground/20 hover:bg-accent/40",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40",
                        )}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                      {isSelected && <Check className="h-3 w-3 text-primary ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title Input */}
            <div>
              <label
                htmlFor="local-card-title-input"
                className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Card Title <span className="text-primary">*</span>
              </label>
              <input
                id="local-card-title-input"
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Implement cookie-based token refresh mechanism"
                aria-label="New card title"
                required
                className={cn(
                  "w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xs outline-none transition-all duration-150",
                  "placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20",
                )}
              />
            </div>

            {/* Description Editor with Tabs */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description / Notes
                </label>
                <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab("write")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      activeTab === "write"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <PenLine className="h-3 w-3" />
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("preview")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors",
                      activeTab === "preview"
                        ? "bg-card text-foreground shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                </div>
              </div>

              {activeTab === "write" ? (
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Add optional notes, checklist, or acceptance criteria (Markdown supported)..."
                  aria-label="New card description"
                  rows={4}
                  className={cn(
                    "w-full rounded-xl border border-border/80 bg-background/80 px-3.5 py-2.5 text-sm text-foreground shadow-xs outline-none transition-all duration-150 font-normal",
                    "placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 no-scrollbar resize-none",
                  )}
                />
              ) : (
                <div className="min-h-[108px] max-h-48 overflow-y-auto rounded-xl border border-border/80 bg-background/50 p-3.5 text-sm text-foreground">
                  {body.trim() ? (
                    <MarkdownContent content={body} />
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Nothing to preview yet. Switch back to Write to add details.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-4">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <kbd className="rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px]">
                  Ctrl+Enter
                </kbd>
                <span>to create</span>
                <span className="text-border mx-1">&bull;</span>
                <kbd className="rounded border border-border/70 bg-background/80 px-1.5 py-0.5 font-mono text-[10px]">
                  Esc
                </kbd>
                <span>to cancel</span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleClose}
                  className="rounded-xl px-3 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  aria-label="Add card"
                  disabled={!title.trim() || create.isPending}
                  loading={create.isPending}
                  className="rounded-xl px-4 text-xs font-semibold shadow-md shadow-primary/20"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add card
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </div>
    </Portal>
  );
}
