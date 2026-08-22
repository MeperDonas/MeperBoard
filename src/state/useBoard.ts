import { useQuery } from "@tanstack/react-query";

import { loadBoard, type Board } from "./cards";
import { queryKeys } from "./query-keys";
import { useActiveRepo } from "./use-repos";
import { DEFAULT_REPO_ID } from "./useSync";

/**
 * Board projection over the local store — columns + resolved cards.
 *
 * The query key includes the active repo id so switching repos produces a new
 * key (and the `useSetActiveRepo` invalidation re-fetches it), and the read
 * filters `github_items` to that repo. Local cards are included regardless.
 */
export function useBoard() {
  const activeRepo = useActiveRepo();
  const repoId = activeRepo.data?.id ?? DEFAULT_REPO_ID;

  return useQuery<Board>({
    queryKey: [...queryKeys.board, repoId],
    queryFn: () => loadBoard(repoId),
  });
}
