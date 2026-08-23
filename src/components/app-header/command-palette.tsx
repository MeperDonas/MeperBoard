"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  FolderGit2,
  Home,
  List,
  LogOut,
  Moon,
  PanelRight,
  Plus,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "../../lib/utils";
import { useGuardedRouter } from "../../lib/use-guarded-router";
import {
  applyThemeToDom,
  type ThemePreference,
} from "../../lib/theme-preference";
import {
  ACCENT_THEMES,
  applyAccentToDom,
  saveStoredAccent,
} from "../../lib/themes";
import { useSync } from "../../state";
import { OPEN_CREATE_LOCAL_CARD_EVENT } from "../local-cards";
import { Portal } from "../ui/portal";
import { GithubMark } from "./github-mark";
import { OPEN_REPO_SWITCHER_EVENT } from "./repo-switcher";
import { useAuth, type AuthUser } from "./use-auth";

/** Cross-component signal the palette emits; the board toggles its local rail on it. */
export const TOGGLE_LOCAL_CARDS_EVENT = "meperboard:toggle-local-cards";

type CommandGroup = "Navigation" | "Theme" | "Auth" | "Cards" | "Quick Actions";

const GROUP_ORDER: readonly CommandGroup[] = [
  "Navigation",
  "Theme",
  "Auth",
  "Cards",
  "Quick Actions",
];

interface Command {
  id: string;
  group: CommandGroup;
  label: string;
  keywords?: string;
  /** Leading visual — a lucide icon, a color swatch, or a custom node. */
  icon?: LucideIcon;
  /** Solid color shown as a round swatch instead of an icon (theme palettes). */
  swatch?: string;
  /** Custom leading node (e.g. the GitHub mark for the connect command). */
  leading?: ReactNode;
  /** Show the current user's avatar beside the command (auth commands). */
  avatar?: boolean;
  /** Short helper/subtitle under the label ("Coming soon", shortcut, etc.). */
  hint?: string;
  disabled?: boolean;
  run?: () => void;
}

const PANEL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;

/**
 * ⌘K command palette for the header. Opened by the ⌘K/Ctrl+K shortcut or by a
 * click on the inline search pill; navigates with arrows/Home/End, selects with
 * Enter, closes on Escape or a backdrop click. Groups follow AUTH_PLAN §7:
 * Navigation, Theme, Auth, Cards, Quick Actions.
 *
 * Commands whose functional backend lives in a later slice (Switch repository,
 * card search/create) render as disabled "Coming soon" placeholders; the rest
 * reuse existing mechanisms (theme/accent helpers, `useAuth`, `useSync`).
 */
export function CommandPalette() {
  const reduceMotion = useReducedMotion() ?? false;
  const router = useGuardedRouter();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activePos, setActivePos] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openRef = useRef(open);
  const uid = useId();
  const listboxId = `${uid}-palette-listbox`;

  const { user, login, logout } = useAuth();
  const sync = useSync();

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const navigate = useCallback(
    (href: string) => {
      if (router) router.push(href);
      else window.location.assign(href);
    },
    [router],
  );

  const close = useCallback(() => setOpen(false), []);
  const openPalette = useCallback(() => setOpen(true), []);

  const toggleLocalCards = useCallback(() => {
    window.dispatchEvent(new CustomEvent(TOGGLE_LOCAL_CARDS_EVENT));
  }, []);

  const switchRepo = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_REPO_SWITCHER_EVENT));
  }, []);

  // Global shortcut + Escape + dialog keyboard navigation handling.
  useEffect(() => {
    function onWindowKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key?.toLowerCase() === "k") {
        event.preventDefault();
        if (openRef.current) {
          setOpen(false);
        } else {
          openPalette();
        }
        return;
      }
      if (event.key === "Escape" && openRef.current) {
        setOpen(false);
        return;
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [openPalette]);

  // On open: reset the query/selection and focus the search field.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActivePos(0);
      inputRef.current?.focus();
    }
  }, [open]);

  const commands = useMemo<Command[]>(
    () =>
      buildCommands({
        user,
        login,
        logout,
        navigate,
        syncNow: () => sync.mutate(),
        toggleLocalCards,
        switchRepo,
      }),
    [user, login, logout, navigate, sync, toggleLocalCards, switchRepo],
  );

  const visibleCommands = useMemo<Command[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(needle) || c.keywords?.toLowerCase().includes(needle),
    );
  }, [commands, query]);

  // Roving index only moves over enabled commands.
  const enabledIndices = useMemo<number[]>(
    () => visibleCommands.flatMap((c, index) => (c.disabled ? [] : [index])),
    [visibleCommands],
  );
  const enabledCount = enabledIndices.length;
  const safeActivePos = enabledCount > 0 ? Math.min(activePos, enabledCount - 1) : 0;
  const activeIndex = enabledIndices[safeActivePos] ?? -1;

  // Keep the active option visible while roving with the keyboard.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = document.getElementById(`${listboxId}-option-${activeIndex}`);
    node?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeIndex, listboxId]);

  function runCommand(command: Command) {
    if (command.disabled || !command.run) return;
    command.run();
    close();
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivePos((position) => (enabledCount > 0 ? (position + 1) % enabledCount : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivePos((position) =>
        enabledCount > 0 ? (position - 1 + enabledCount) % enabledCount : 0,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActivePos(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActivePos(Math.max(0, enabledCount - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = visibleCommands[activeIndex];
      if (command?.run) runCommand(command);
    }
  }

  const shortcutLabel = "Ctrl-K";

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        aria-label="Open command palette"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`Search and run commands (${shortcutLabel})`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2 text-xs font-medium text-muted-foreground shadow-xs transition-colors duration-150",
          "hover:border-foreground/20 hover:text-foreground",
          open && "border-primary/60 text-foreground",
        )}
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden text-muted-foreground/80 sm:inline">Search…</span>
        <kbd
          aria-hidden="true"
          className="rounded border border-border/60 bg-background/60 px-1 font-mono text-[10px] text-muted-foreground"
        >
          {shortcutLabel}
        </kbd>
      </button>

      {open && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm"
              onClick={close}
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
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  role="combobox"
                  aria-label="Search commands"
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
                  placeholder="Type a command or search…"
                  className="h-6 w-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <kbd
                  aria-hidden="true"
                  className="shrink-0 rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                >
                  esc
                </kbd>
              </div>

              <div
                id={listboxId}
                role="listbox"
                aria-label="Commands"
                className="max-h-[55vh] overflow-y-auto p-2 no-scrollbar"
              >
                {GROUP_ORDER.map((group) => {
                  const items = visibleCommands.filter((command) => command.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="mb-2 last:mb-0">
                      <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {items.map((command) => {
                          const index = visibleCommands.indexOf(command);
                          const isActive = index === activeIndex;
                          return (
                            <div
                              key={command.id}
                              id={`${listboxId}-option-${index}`}
                              role="option"
                              aria-selected={isActive}
                              aria-disabled={command.disabled || undefined}
                              data-active={isActive}
                              onMouseMove={(event) => {
                                if (event.movementX === 0 && event.movementY === 0) return;
                                const position = enabledIndices.indexOf(index);
                                if (position >= 0) setActivePos(position);
                              }}
                              onClick={() => {
                                if (command.disabled || !command.run) return;
                                runCommand(command);
                              }}
                              className={cn(
                                "group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-100",
                                isActive && !command.disabled
                                  ? "bg-accent text-accent-foreground ring-1 ring-primary/30"
                                  : "text-foreground hover:bg-accent/50",
                                command.disabled && "cursor-not-allowed opacity-60",
                              )}
                            >
                              {renderLeading(command, user)}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{command.label}</p>
                                {command.hint && (
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {command.hint}
                                  </p>
                                )}
                              </div>
                              {isActive && !command.disabled && (
                                <span className="ml-auto inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground border border-border/60">
                                  <span className="text-[9px]">Select</span> ↵
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {visibleCommands.length === 0 && (
                  <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                    No commands match “{query}”
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

/** Leading visual per command type: custom node, swatch, avatar, or lucide icon. */
function renderLeading(command: Command, user: AuthUser | null) {
  if (command.leading) return command.leading;
  if (command.swatch) {
    return (
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full shadow-xs ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: command.swatch }}
        aria-hidden="true"
      />
    );
  }
  if (command.avatar && user) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full ring-1 ring-border/80"
        aria-hidden="true"
      />
    );
  }
  if (command.icon) {
    return (
      <command.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    );
  }
  return null;
}

interface BuildCommandsArgs {
  user: AuthUser | null;
  login: () => void;
  logout: () => Promise<void>;
  navigate: (href: string) => void;
  syncNow: () => void;
  toggleLocalCards: () => void;
  switchRepo: () => void;
}

const THEME_ICONS: Record<ThemePreference, LucideIcon> = { dark: Moon, light: Sun };

function buildCommands({
  user,
  login,
  logout,
  navigate,
  syncNow,
  toggleLocalCards,
  switchRepo,
}: BuildCommandsArgs): Command[] {
  const commands: Command[] = [
    {
      id: "nav-board",
      group: "Navigation",
      label: "Go to Board",
      keywords: "board dashboard",
      icon: Home,
      run: () => navigate("/"),
    },
    {
      id: "nav-backlog",
      group: "Navigation",
      label: "Go to Backlog",
      keywords: "backlog list",
      icon: List,
      run: () => navigate("/backlog"),
    },
    {
      id: "theme-dark",
      group: "Theme",
      label: "Switch to Dark",
      keywords: "dark theme mode",
      icon: THEME_ICONS.dark,
      run: () => applyThemeToDom("dark"),
    },
    {
      id: "theme-light",
      group: "Theme",
      label: "Switch to Light",
      keywords: "light theme mode",
      icon: THEME_ICONS.light,
      run: () => applyThemeToDom("light"),
    },
    ...ACCENT_THEMES.map((theme) => ({
      id: `theme-${theme.id}`,
      group: "Theme" as const,
      label: `Palette: ${theme.label}`,
      keywords: `${theme.label} ${theme.description}`,
      swatch: theme.swatch,
      run: () => {
        applyAccentToDom(theme.id);
        saveStoredAccent(theme.id);
      },
    })),
  ];

  if (user) {
    commands.push({
      id: "auth-disconnect",
      group: "Auth",
      label: "Disconnect",
      keywords: "logout sign out disconnect",
      icon: LogOut,
      avatar: true,
      run: () => void logout(),
    });
  } else {
    commands.push({
      id: "auth-connect",
      group: "Auth",
      label: "Connect GitHub",
      keywords: "login sign in connect github",
      leading: <GithubMark className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
      run: () => login(),
    });
  }

  commands.push({
    id: "auth-switch-repo",
    group: "Auth",
    label: "Switch repository",
    keywords: "repo repository switch",
    icon: FolderGit2,
    run: () => switchRepo(),
  });

  commands.push(
    {
      id: "cards-search",
      group: "Cards",
      label: "Search cards…",
      keywords: "search cards find issue",
      disabled: true,
      hint: "Fuzzy card search is on the roadmap",
    },
    {
      id: "cards-create-local",
      group: "Cards",
      label: "Create local card",
      keywords: "create new add local card task note",
      icon: Plus,
      run: () => {
        window.dispatchEvent(new CustomEvent(OPEN_CREATE_LOCAL_CARD_EVENT));
      },
    },
  );

  commands.push(
    {
      id: "qa-sync",
      group: "Quick Actions",
      label: "Sync now",
      keywords: "sync refresh import",
      icon: RefreshCw,
      run: () => syncNow(),
    },
    {
      id: "qa-local-panel",
      group: "Quick Actions",
      label: "Toggle local cards panel",
      keywords: "local cards rail panel toggle",
      icon: PanelRight,
      run: () => toggleLocalCards(),
    },
  );

  return commands;
}
