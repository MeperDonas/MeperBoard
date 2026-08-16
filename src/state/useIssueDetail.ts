import { useQuery } from "@tanstack/react-query";

import { githubItemRepo } from "../data/repositories";
import type { GithubItem, RepoId } from "../data/types";
import { queryKeys } from "./query-keys";

/**
 * Read-only detail for a selected GitHub issue/PR. Disabled until a repo and
 * number are selected; resolves to `null` when the item is not found.
 */
export function useIssueDetail(repo?: RepoId, number?: number) {
  return useQuery<GithubItem | null>({
    queryKey: [...queryKeys.issueDetail, repo, number],
    queryFn: async () =>
      repo != null && number != null ? ((await githubItemRepo.get(repo, number)) ?? null) : null,
    enabled: repo != null && number != null,
  });
}
