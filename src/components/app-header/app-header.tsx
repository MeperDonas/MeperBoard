"use client";

import Link from "next/link";

/**
 * Minimal app shell header: brand + primary navigation. Kept as a client
 * component so `next/link` client-side navigation works on every page.
 */
export function AppHeader() {
  return (
    <header className="border-b">
      <nav className="flex items-center gap-4 px-4 py-3" aria-label="Primary">
        <Link href="/" className="text-sm font-semibold">
          MeperBoard
        </Link>
        <Link
          href="/backlog"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Backlog
        </Link>
      </nav>
    </header>
  );
}
