"use client";

import { useRouter } from "next/navigation";

/**
 * `useRouter` that tolerates rendering outside a Next.js app-router context
 * (unit tests render pages directly). Returns the router, or `null` when no
 * app router is mounted; callers must handle the null case.
 */
export function useGuardedRouter(): ReturnType<typeof useRouter> | null {
  try {
    return useRouter();
  } catch {
    return null;
  }
}
