import { useQuery } from "@tanstack/react-query";

import {
  filterCards,
  loadCards,
  sortCards,
  type BacklogFilters,
  type BacklogSort,
  type Card,
} from "./cards";
import { queryKeys } from "./query-keys";
import { useActiveRepo } from "./use-repos";
import { DEFAULT_REPO_ID } from "./useSync";

/**
 * Flat, filterable, sortable list of cards (github + local).
 *
 * The query key includes the active repo id so the `useSetActiveRepo`
 * invalidation re-fetches a distinct key after a repo switch, and the read
 * filters `github_items` to the active repo (defaulting to `DEFAULT_REPO_ID`).
 * Local cards are always included.
 */
export function useBacklog(filters: BacklogFilters = {}, sort?: BacklogSort) {
  const activeRepo = useActiveRepo();
  const repoId = activeRepo.data?.id ?? DEFAULT_REPO_ID;

  return useQuery<Card[]>({
    queryKey: [...queryKeys.backlog, filters, sort, repoId],
    queryFn: async () => sortCards(filterCards(await loadCards(repoId), filters), sort),
  });
}
