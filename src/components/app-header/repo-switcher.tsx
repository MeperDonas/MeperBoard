"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Clock, Database, FolderGit2, Loader2, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { loadRecentRepos, saveRecentRepo } from "../../lib/recent-repos";
import { getRepoColorScheme } from "../../lib/repo-colors";
import { cn } from "../../lib/utils";
import { useActiveRepos, useToggleActiveRepo, useUserRepos } from "../../state";
import { Portal } from "../ui/portal";

/** Cross-component signal the switcher listens for (AuthMenu + CommandPalette). */
export const OPEN_REPO_SWITCHER_EVENT = "meperboard:open-repo-switcher";

const PANEL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * Combobox repository switcher. Lists the user's repositories LIVE from GitHub
 * via the read-only proxy (`GET /user/repos`) — never from a cookie snapshot
 * (AUTH_PLAN v2.1 §0.1). Shows a "Recent" section first, followed by all repositories.
 * Fuzzy search over `owner/name`, keyboard navigation
 * (arrows/Home/End/Enter/Escape), and multi-select toggles active repositories
 * through `repoRepo` and invalidates board/backlog/detail reads.
 */
export function RepoSwitcher() {
  const reduceMotion = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activePos, setActivePos] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef(open);
  const uid = useId();
  const listboxId = `${uid}-repo-listbox`;

  const activeReposQuery = useActiveRepos();
  const toggleActive = useToggleActiveRepo();
  const activeRepos = activeReposQuery.data ?? [];
  const activeRepoIds = useMemo(() => new Set(activeRepos.map((r) => r.id)), [activeRepos]);

  // Only fetch the live list once the panel is open (avoid a proxy call at header mount).
  const reposQuery = useUserRepos(open);
  const repos = reposQuery.data ?? [];

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Open on the shared event; focus the search field.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setQuery("");
      setActivePos(0);
      setRecentIds(loadRecentRepos());
    }
    window.addEventListener(OPEN_REPO_SWITCHER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REPO_SWITCHER_EVENT, onOpen);
  }, []);

  const { items, recentCount } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? repos.filter(
          (repo) =>
            repo.id.toLowerCase().includes(needle) || repo.name.toLowerCase().includes(needle),
        )
      : repos;

    const recentMatches = matched.filter((r) => recentIds.includes(r.id));
    const otherMatches = matched.filter((r) => !recentIds.includes(r.id));

    const allItems: { repo: { owner: string; name: string; id: string }; isRecent: boolean }[] = [
      ...recentMatches.map((repo) => ({ repo, isRecent: true })),
      ...otherMatches.map((repo) => ({ repo, isRecent: false })),
    ];

    return {
      items: allItems,
      recentCount: recentMatches.length,
    };
  }, [repos, query, recentIds]);

  const enabledCount = items.length;
  const safePos = enabledCount > 0 ? Math.min(activePos, enabledCount - 1) : 0;
  const activeIndex = safePos;

  const enabledCountRef = useRef(enabledCount);
  enabledCountRef.current = enabledCount;

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const itemsRef = useRef(items);
  itemsRef.current = items;

  function toggleRepo(owner: string, name: string) {
    const repoId = `${owner}/${name}`;
    saveRecentRepo(repoId);
    setRecentIds(loadRecentRepos());
    toggleActive.mutate({ owner, name });
  }

  // Window-level keydown handler for Escape, Arrow keys, Enter, Home, End
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!openRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const count = enabledCountRef.current;
        if (count > 0) {
          setActivePos((prev) => (prev + 1) % count);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const count = enabledCountRef.current;
        if (count > 0) {
          setActivePos((prev) => (prev - 1 + count) % count);
        }
      } else if (event.key === "Home") {
        event.preventDefault();
        setActivePos(0);
      } else if (event.key === "End") {
        event.preventDefault();
        const count = enabledCountRef.current;
        if (count > 0) {
          setActivePos(count - 1);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        const idx = activeIndexRef.current;
        const list = itemsRef.current;
        const item = list[idx];
        if (item) {
          toggleRepo(item.repo.owner, item.repo.name);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus the search field when opening.
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keep the active option visible while roving.
  useEffect(() => {
    if (!open || enabledCount === 0) return;
    const node = document.getElementById(`${listboxId}-option-${activeIndex}`);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, enabledCount, listboxId]);

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
      return;
    }
  }

  return (
    <>
      {open && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Switch repository"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={PANEL_SPRING}
              className="relative z-10 flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-xl ring-1 ring-border/50"
            >
              <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
                <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-label="Search repositories"
                  aria-expanded
                  aria-controls={listboxId}
                  aria-activedescendant={
                    activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
                  }
                  aria-autocomplete="list"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActivePos(0);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Search repositories…"
                  className="h-6 w-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                {reposQuery.isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close repository switcher"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-b border-border/40 px-4 py-1.5 text-xs text-muted-foreground bg-muted/20">
                <span className="flex items-center gap-1.5 font-medium">
                  <Database className="h-3 w-3 text-primary" aria-hidden="true" />
                  {activeRepos.length === 0
                    ? "No repositories active"
                    : `${activeRepos.length} active ${activeRepos.length === 1 ? "repository" : "repositories"}`}
                </span>
                <span className="text-[11px] text-muted-foreground/80">Click or press Enter to toggle</span>
              </div>

              <div
                id={listboxId}
                role="listbox"
                aria-label="Repositories"
                className="max-h-[55vh] overflow-y-auto p-2 no-scrollbar"
              >
                {reposQuery.isError ? (
                  <div className="px-2 py-8 text-center text-sm text-destructive">
                    Failed to load repositories.
                  </div>
                ) : reposQuery.isSuccess && items.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    {query ? `No repositories match “${query}”` : "No repositories found"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {items.map((item, index) => {
                      const { repo, isRecent } = item;
                      const isFirstRecent = isRecent && index === 0;
                      const isFirstOther = !isRecent && index === recentCount && recentCount > 0;
                      const isActive = index === activeIndex;
                      const isSelected = activeRepoIds.has(repo.id);
                      const scheme = getRepoColorScheme(repo.id);

                      return (
                        <div key={repo.id} className="flex flex-col gap-0.5">
                          {isFirstRecent && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              <Clock className="h-3 w-3 text-primary" aria-hidden="true" />
                              <span>Recent</span>
                            </div>
                          )}
                          {isFirstOther && (
                            <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-t border-border/40 mt-1">
                              <FolderGit2 className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              <span>All Repositories</span>
                            </div>
                          )}
                          <div
                            id={`${listboxId}-option-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            data-active={isActive}
                            onMouseMove={(event) => {
                              if (event.movementX === 0 && event.movementY === 0) return;
                              setActivePos(index);
                            }}
                            onClick={() => toggleRepo(repo.owner, repo.name)}
                            className={cn(
                              "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100",
                              isActive
                                ? "bg-accent text-accent-foreground ring-1 ring-primary/30"
                                : "text-foreground hover:bg-accent/50",
                              isSelected && "text-primary font-medium",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/40 bg-transparent",
                              )}
                            >
                              {isSelected && <Check className="h-3 w-3" aria-hidden="true" />}
                            </div>
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: scheme.dot }}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate font-medium">{repo.id}</span>
                            {isRecent && (
                              <span className="text-[10px] font-mono text-muted-foreground/80 bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                                recent
                              </span>
                            )}
                            {isActive && (
                              <span className="ml-auto inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60">
                                <span className="text-[9px]">Toggle</span> ↵
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 bg-card/60">
                <span className="text-xs text-muted-foreground font-mono">
                  {activeRepos.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        </Portal>
      )}
    </>
  );
}
