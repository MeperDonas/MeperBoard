"use client";

import { useEffect, useState } from "react";

/**
 * Debounce a fast-changing value (e.g. a search input) before it feeds an
 * expensive derived pipeline. Returns the value delayed by `delayMs`.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
