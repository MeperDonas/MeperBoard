"use client";

import { useEffect, useState } from "react";

/**
 * Reactive `(min-width: …)` media query hook. SSR-safe: defaults to `false`
 * until mounted (the server never knows the viewport). jsdom tests get the
 * inert `matchMedia` stub from the vitest setup, which reports no-match.
 */
export function useMinWidth(px: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [px]);

  return matches;
}
