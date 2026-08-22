"use client";

import { LayoutGrid } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "../../lib/utils";
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
 * App shell header: brand, primary navigation with a clear active state, and
 * the theme toggle. Kept as a client component so `next/link` client-side
 * navigation and `usePathname` work on every page.
 */
export function AppHeader() {
  // usePathname() returns null outside a Next.js router context (e.g. tests).
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <nav className="flex h-14 items-center gap-2 px-4 md:px-6" aria-label="Primary">
        <Link
          href="/"
          className="mr-4 flex items-center gap-2 rounded-md text-sm font-semibold tracking-tight"
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </span>
          MeperBoard
        </Link>

        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {item.label}
              {active && (
                <span
                  className="absolute -bottom-[9px] left-1 right-1 h-0.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}

        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
