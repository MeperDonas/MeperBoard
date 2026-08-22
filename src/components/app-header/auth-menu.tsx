"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Activity, Database, FolderGit2, LogOut } from "lucide-react";

import type { Repo } from "../../data/types";
import { OPEN_REPO_SWITCHER_EVENT } from "./repo-switcher";
import type { AuthUser } from "./use-auth";

interface AuthMenuProps {
  user: AuthUser;
  /** The persisted active repo, or `undefined` while it resolves. */
  activeRepo?: Repo;
  onLogout: () => void;
  onClose: () => void;
}

/**
 * Account dropdown for the authenticated header state.
 *
 * Shows the profile (avatar + login), the active repo (from repoRepo — the
 * RepoSwitcher source of truth), the read-only rate-limit snapshot (still a
 * placeholder in this slice), a "Switch repository" action that opens the live
 * RepoSwitcher, and a logout action. Reacts and re-renders through the shared
 * `useAuth` + `useActiveRepo` state.
 */
export function AuthMenu({ user, activeRepo, onLogout, onClose }: AuthMenuProps) {
  const reduceMotion = useReducedMotion() ?? false;

  function handleLogout() {
    void onLogout();
    onClose();
  }

  function handleSwitchRepo() {
    window.dispatchEvent(new CustomEvent(OPEN_REPO_SWITCHER_EVENT));
    onClose();
  }

  const activeRepoLabel = activeRepo ? `${activeRepo.owner}/${activeRepo.name}` : "—";
  const rateLimitLabel = user.rate_limit?.remaining ?? "—";

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      role="menu"
      aria-label="Account menu"
      className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-md ring-1 ring-border/50"
    >
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <img
          src={user.avatar_url}
          alt={user.login}
          className="h-9 w-9 rounded-full ring-1 ring-border/80"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{user.login}</p>
          <p className="truncate text-[10px] text-muted-foreground">Connected to GitHub</p>
        </div>
      </div>

      <div className="mx-1 my-1 h-px bg-border/50" aria-hidden="true" />

      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          Active repo
        </span>
        <span className="max-w-32 truncate font-medium text-foreground">{activeRepoLabel}</span>
      </div>

      <button
        type="button"
        role="menuitem"
        onClick={handleSwitchRepo}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
      >
        <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
        Switch repository
      </button>

      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Rate limit
        </span>
        <span className="font-medium text-foreground">{rateLimitLabel}</span>
      </div>

      <div className="mx-1 my-1 h-px bg-border/50" aria-hidden="true" />

      <button
        type="button"
        role="menuitem"
        onClick={handleLogout}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Disconnect
      </button>
    </motion.div>
  );
}
