import { useQuery } from "@tanstack/react-query";

import { loadBoard, type Board } from "./cards";
import { queryKeys } from "./query-keys";
import { useActiveRepos } from "./use-repos";
import { DEFAULT_REPO_ID } from "./useSync";

/**
 * Board projection over the local store — columns + resolved cards.
 *
 * The query key includes the active repo ids so switching repos produces a new
 * key (and the `useToggleActiveRepo` / `useSetActiveRepo` invalidation re-fetches it),
 * and the read filters `github_items` to those repos. Local cards are included regardless.
 */
export function useBoard() {
  const activeRepos = useActiveRepos();
  const repoIds = (activeRepos.data && activeRepos.data.length > 0)
    ? activeRepos.data.map((r) => r.id).sort()
    : [DEFAULT_REPO_ID];

  return useQuery<Board>({
    queryKey: [...queryKeys.board, ...repoIds],
    queryFn: () => loadBoard(repoIds),
  });
}
