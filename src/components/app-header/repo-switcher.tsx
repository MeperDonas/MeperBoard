"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Database, FolderGit2, Loader2, X } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { cn } from "../../lib/utils";
import { useActiveRepo, useSetActiveRepo, useUserRepos } from "../../state";
import { Portal } from "../ui/portal";

/** Cross-component signal the switcher listens for (AuthMenu + CommandPalette). */
export const OPEN_REPO_SWITCHER_EVENT = "meperboard:open-repo-switcher";

const PANEL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * Combobox repository switcher. Lists the user's repositories LIVE from GitHub
 * via the read-only proxy (`GET /user/repos`) — never from a cookie snapshot
 * (AUTH_PLAN v2.1 §0.1). Fuzzy search over `owner/name`, keyboard navigation
 * (arrows/Home/End/Enter/Escape), and selecting a repo persists it as the
 * active repo through `repoRepo` and invalidates board/backlog/detail reads.
 *
 * The panel is lazy: it does not mount or fetch the repo list until
 * `OPEN_REPO_SWITCHER_EVENT` is dispatched (from the auth menu or the ⌘K
 * palette). Follows the select.tsx combobox/listbox a11y pattern.
 */
export function RepoSwitcher() {
  const reduceMotion = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activePos, setActivePos] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef(open);
  const uid = useId();
  const listboxId = `${uid}-repo-listbox`;

  const activeRepo = useActiveRepo();
  const setActive = useSetActiveRepo();
  // Only fetch the live list once the panel is open (avoid a proxy call at header mount).
  const reposQuery = useUserRepos(open);
  const repos = reposQuery.data ?? [];

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Open on the shared event; focus the search field. The query is lazily
  // enabled via `reposQuery.fetchStatus` gated on `open` below.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setQuery("");
      setActivePos(0);
    }
    window.addEventListener(OPEN_REPO_SWITCHER_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REPO_SWITCHER_EVENT, onOpen);
  }, []);

  const filtered = useMemo<{ owner: string; name: string; id: string }[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return repos;
    return repos.filter(
      (repo) => repo.id.toLowerCase().includes(needle) || repo.name.toLowerCase().includes(needle),
    );
  }, [repos, query]);

  const enabledCount = filtered.length;
  const safePos = enabledCount > 0 ? Math.min(activePos, enabledCount - 1) : 0;
  const activeIndex = safePos;

  const enabledCountRef = useRef(enabledCount);
  enabledCountRef.current = enabledCount;

  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  function selectRepo(owner: string, name: string) {
    setActive.mutate({ owner, name });
    setOpen(false);
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
        const list = filteredRef.current;
        const repo = list[idx];
        if (repo) {
          selectRepo(repo.owner, repo.name);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch the live list is gated by `enabled={open}` on `useUserRepos`.
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

  const currentActive = activeRepo.data
    ? `${activeRepo.data.owner}/${activeRepo.data.name}`
    : null;

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

              <div
                id={listboxId}
                role="listbox"
                aria-label="Repositories"
                className="max-h-[55vh] overflow-y-auto p-2 no-scrollbar"
              >
                {currentActive && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Database className="h-3 w-3" aria-hidden="true" />
                    Active: {currentActive}
                  </div>
                )}

                {reposQuery.isError ? (
                  <div className="px-2 py-8 text-center text-sm text-destructive">
                    Failed to load repositories.
                  </div>
                ) : reposQuery.isSuccess && filtered.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    {query ? `No repositories match “${query}”` : "No repositories found"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    {filtered.map((repo, index) => {
                      const isActive = index === activeIndex;
                      const isSelected = repo.id === currentActive;
                      return (
                        <div
                          key={repo.id}
                          id={`${listboxId}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          data-active={isActive}
                          onMouseMove={(event) => {
                            if (event.movementX === 0 && event.movementY === 0) return;
                            setActivePos(index);
                          }}
                          onClick={() => selectRepo(repo.owner, repo.name)}
                          className={cn(
                            "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100",
                            isActive
                              ? "bg-accent text-accent-foreground ring-1 ring-primary/30"
                              : "text-foreground hover:bg-accent/50",
                            isSelected && "text-primary font-medium",
                          )}
                        >
                          <FolderGit2
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{repo.id}</span>
                          {isSelected && (
                            <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                          )}
                          {isActive && (
                            <span className="ml-auto inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60">
                              <span className="text-[9px]">Select</span> ↵
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </Portal>
      )}
    </>
  );
}
