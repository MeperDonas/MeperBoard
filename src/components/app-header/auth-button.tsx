"use client";

import { AnimatePresence } from "framer-motion";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import { useActiveRepos } from "../../state";
import { AuthMenu } from "./auth-menu";
import { ConnectModal } from "./connect-modal";
import { GithubMark } from "./github-mark";
import { useAuth } from "./use-auth";

/**
 * Authentication control for the app header.
 *
 * While the session check resolves it renders a disabled loading state. When
 * logged out it shows a "Connect GitHub" pill that opens the permission
 * explainer (`ConnectModal`); when logged in it shows the avatar + login pill
 * that opens the account dropdown (`AuthMenu`).
 */
export function AuthButton() {
  const { user, isLoading, login, logout } = useAuth();
  const activeRepos = useActiveRepos();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen && !modalOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setModalOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setModalOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, modalOpen]);

  if (isLoading) {
    return (
      <button
        type="button"
        aria-label="Checking account"
        disabled
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium text-muted-foreground opacity-70"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      </button>
    );
  }

  if (user) {
    return (
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Account for ${user.login}`}
          title={`Logged in as ${user.login}`}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2 text-xs font-medium text-foreground shadow-xs transition-colors duration-150",
            "hover:border-foreground/20",
            menuOpen && "border-primary/60",
          )}
        >
          <img
            src={user.avatar_url}
            alt={user.login}
            className="h-5 w-5 rounded-full ring-1 ring-border/80 shrink-0"
          />
          <span className="max-w-16 sm:max-w-32 truncate">{user.login}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 shrink-0",
              menuOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <AuthMenu
              user={user}
              activeRepos={activeRepos.data}
              onLogout={() => void logout()}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-expanded={modalOpen}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2 sm:px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors duration-150",
          "hover:border-foreground/20 hover:text-foreground",
          modalOpen && "border-primary/60 text-foreground",
        )}
      >
        <GithubMark className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Connect GitHub</span>
        <span className="inline sm:hidden">Connect</span>
      </button>

      <AnimatePresence>
        {modalOpen && <ConnectModal onClose={() => setModalOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}
