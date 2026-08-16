import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { db } from "../data/db";
import type { GithubItem, LocalItem } from "../data/types";

/**
 * Shared test helpers for the state layer: a fresh QueryClient (retries off so
 * error-state assertions are deterministic) and IndexedDB fixtures.
 */

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function queryWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export async function resetDb(): Promise<void> {
  await db.delete();
  await db.open();
}

export function makeGithubItem(overrides: Partial<GithubItem> = {}): GithubItem {
  return {
    repo: "meperdonas/meperboard",
    number: 1,
    kind: "issue",
    title: "Add login",
    body: "",
    state: "open",
    labels: [],
    html_url: "https://github.com/meperdonas/meperboard/issues/1",
    linked_prs: [],
    github_updated_at: "2026-08-01T00:00:00Z",
    synced_at: "2026-08-15T00:00:00Z",
    column_id: null,
    ...overrides,
  };
}

export function makeLocalItem(overrides: Partial<LocalItem> = {}): LocalItem {
  return {
    id: "l1",
    title: "Buy milk",
    body: "",
    labels: [],
    column_id: "todo",
    position: 0,
    epic_id: null,
    created_at: "2026-08-15T00:00:00Z",
    ...overrides,
  };
}
