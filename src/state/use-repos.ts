import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { repoRepo } from "../data/repositories";
import type { Repo } from "../data/types";
import { queryKeys } from "./query-keys";

/** A repo from the live `GET /user/repos` list (never a cookie snapshot). */
export interface RepoRef {
  owner: string;
  name: string;
  /** `owner/name` — the same RepoId used by `github_items.repo`. */
  id: string;
}

/** React Query key for the persisted active repo (legacy single repo). */
export const ACTIVE_REPO_KEY = ["repo", "active"] as const;

/** React Query key for all persisted active repos. */
export const ACTIVE_REPOS_KEY = ["repos", "active"] as const;

/**
 * The user's repositories, listed live from GitHub via the read-only proxy
 * (`GET /user/repos`). The projector only ever reads `owner`/`name`; the repo
 * list is never frozen into the session cookie (AUTH_PLAN v2.1 §0.1).
 */
export async function fetchUserRepos(): Promise<RepoRef[]> {
  const response = await fetch("/api/github/user/repos");
  if (!response.ok) {
    throw new Error(`Failed to load repositories: ${response.status}`);
  }
  const payload = (await response.json()) as Array<{
    full_name?: string;
    name?: string;
    owner?: { login?: string };
  }>;
  return (payload ?? [])
    .map((repo) => {
      const owner = repo.owner?.login ?? repo.full_name?.split("/")[0] ?? "";
      const name = repo.name ?? repo.full_name?.split("/")[1] ?? "";
      return owner && name ? { owner, name, id: `${owner}/${name}` } : null;
    })
    .filter((repo): repo is RepoRef => repo !== null);
}

/** Live user-repo list via the proxy (`GET /user/repos`). Lazily enabled so the
 * header does not issue a proxy call until the switcher actually opens. */
export function useUserRepos(enabled = true) {
  return useQuery<RepoRef[]>({
    queryKey: queryKeys.userRepos,
    queryFn: fetchUserRepos,
    enabled,
    staleTime: 1_000,
  });
}

/** All currently active repos. */
export function useActiveRepos() {
  return useQuery<Repo[]>({
    queryKey: ACTIVE_REPOS_KEY,
    queryFn: () => repoRepo.getActiveRepos(),
  });
}

/** The persisted single active repo (or first active), or `undefined` before it resolves. */
export function useActiveRepo() {
  return useQuery<Repo | undefined>({
    queryKey: ACTIVE_REPO_KEY,
    queryFn: () => repoRepo.getActive(),
  });
}

/** Toggle a repo's active state and invalidate queries. */
export function useToggleActiveRepo() {
  const queryClient = useQueryClient();
  return useMutation<Repo, Error, { owner: string; name: string }>({
    mutationFn: ({ owner, name }) => repoRepo.toggleActive(owner, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACTIVE_REPOS_KEY });
      void queryClient.invalidateQueries({ queryKey: ACTIVE_REPO_KEY });
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail });
    },
  });
}

/**
 * Persist a repo as active (repoRepo row) and refresh every derived read
 * (board/backlog/detail) so the board re-filters to the chosen repo.
 */
export function useSetActiveRepo() {
  const queryClient = useQueryClient();
  return useMutation<Repo, Error, { owner: string; name: string }>({
    mutationFn: ({ owner, name }) => repoRepo.setActive(owner, name),
    onSuccess: (repo) => {
      queryClient.setQueryData(ACTIVE_REPO_KEY, repo);
      void queryClient.invalidateQueries({ queryKey: ACTIVE_REPOS_KEY });
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail });
    },
  });
}
