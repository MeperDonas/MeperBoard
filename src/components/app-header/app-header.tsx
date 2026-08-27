"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "../../lib/utils";
import { CreateCardModal } from "../local-cards";
import { AuthButton } from "./auth-button";
import { CommandPalette } from "./command-palette";
import { PalettePicker } from "./palette-picker";
import { RepoButton } from "./repo-button";
import { RepoSwitcher } from "./repo-switcher";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "Board", isActive: (pathname: string) => pathname === "/" },
  {
    href: "/backlog",
    label: "Backlog",
    isActive: (pathname: string) => pathname.startsWith("/backlog"),
  },
];

/**
 * App shell header: brand, primary navigation with a clear active state,
 * dynamic palette picker, and the theme toggle.
 */
export function AppHeader() {
  // usePathname() returns null outside a Next.js router context (e.g. tests).
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 dark:border-primary/10 bg-background/85 backdrop-blur-md">
      <nav className="flex h-14 items-center gap-1.5 px-3 sm:gap-2 sm:px-4 md:px-6" aria-label="Primary">
        <Link
          href="/"
          className="mr-1 sm:mr-4 flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/30 ring-1 ring-primary/40 shrink-0"
            aria-hidden="true"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </span>
          <span className="hidden xs:inline sm:inline bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
            MeperBoard
          </span>
        </Link>

        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-md px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-all duration-150 shrink-0",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {item.label}
              {active && (
                <span
                  className="absolute -bottom-[9px] left-1 right-1 h-0.5 rounded-full bg-primary shadow-xs shadow-primary/40"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <RepoButton />
          <CommandPalette />
          <AuthButton />
          <PalettePicker />
          <ThemeToggle />
        </div>
      </nav>
      <RepoSwitcher />
      <CreateCardModal />
    </header>
  );
}
