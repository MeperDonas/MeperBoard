import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { localItemRepo } from "../data/repositories";
import type { LocalItem, RepoId } from "../data/types";
import { localStatusStrategy, type LocalStatus } from "../domain/columns";
import { queryKeys } from "./query-keys";

export interface LocalCardInput {
  title: string;
  body?: string;
  labels?: string[];
  status?: LocalStatus;
  repo?: RepoId | null;
}

export interface LocalCardsOptions {
  idFactory?: () => string;
  now?: () => string;
}

/**
 * Local-card CRUD, fully independent of GitHub. Cards map to columns via the
 * `local-status` strategy; a GitHub sync never touches them.
 */
export function useLocalCards(options: LocalCardsOptions = {}) {
  const queryClient = useQueryClient();

  const list = useQuery<LocalItem[]>({
    queryKey: queryKeys.localCards,
    queryFn: () => localItemRepo.getAll(),
  });

  const create = useMutation({
    mutationFn: (input: LocalCardInput) => createLocalCard(input, options),
    onSuccess: () => invalidateDerived(queryClient),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LocalItem> }) =>
      updateLocalCard(id, patch),
    onSuccess: () => invalidateDerived(queryClient),
  });

  const remove = useMutation({
    mutationFn: (id: string) => localItemRepo.delete(id),
    onSuccess: () => invalidateDerived(queryClient),
  });

  return { list, create, update, remove };
}

async function createLocalCard(
  input: LocalCardInput,
  options: LocalCardsOptions,
): Promise<LocalItem> {
  const status = input.status ?? "todo";
  const columnId = localStatusStrategy.columnFor(status);
  const existing = await localItemRepo.getAll();
  const nextPosition =
    existing
      .filter((item) => item.column_id === columnId)
      .reduce((max, item) => Math.max(max, item.position), -1) + 1;

  const item: LocalItem = {
    id: (options.idFactory ?? defaultIdFactory)(),
    title: input.title,
    body: input.body ?? "",
    labels: input.labels ?? [],
    column_id: columnId,
    position: nextPosition,
    epic_id: null,
    repo: input.repo ?? null,
    created_at: (options.now ?? defaultNow)(),
  };
  await localItemRepo.upsert(item);
  return item;
}

async function updateLocalCard(id: string, patch: Partial<LocalItem>): Promise<LocalItem> {
  const existing = await localItemRepo.get(id);
  if (!existing) throw new Error(`Local card not found: ${id}`);
  const updated: LocalItem = { ...existing, ...patch, id: existing.id };
  await localItemRepo.upsert(updated);
  return updated;
}

function invalidateDerived(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.localCards });
  void queryClient.invalidateQueries({ queryKey: queryKeys.board });
  void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultIdFactory(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
