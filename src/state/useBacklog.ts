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
import { useActiveRepos } from "./use-repos";
import { DEFAULT_REPO_ID } from "./useSync";

/**
 * Flat, filterable, sortable list of cards (github + local).
 *
 * The query key includes the active repo ids so the `useToggleActiveRepo` / `useSetActiveRepo`
 * invalidation re-fetches a distinct key after a repo switch, and the read
 * filters `github_items` to the active repos (defaulting to `DEFAULT_REPO_ID`).
 * Local cards are always included.
 */
export function useBacklog(filters: BacklogFilters = {}, sort?: BacklogSort) {
  const activeRepos = useActiveRepos();
  const repoIds = (activeRepos.data && activeRepos.data.length > 0)
    ? activeRepos.data.map((r) => r.id).sort()
    : [DEFAULT_REPO_ID];

  return useQuery<Card[]>({
    queryKey: [...queryKeys.backlog, filters, sort, ...repoIds],
    queryFn: async () => sortCards(filterCards(await loadCards(repoIds), filters), sort),
  });
}
