import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { githubItemRepo } from "../data/repositories";
import type { GithubItem } from "../data/types";
import { GitHubConnector } from "../domain/sync";
import { queryKeys } from "./query-keys";

const GITHUB_API_ORIGIN = "https://api.github.com";

/** Default source repository — MeperPOS is the board's first tracked repo. */
export const DEFAULT_REPO = { owner: "MeperDonas", name: "MeperPOS" } as const;

export interface SyncOptions {
  owner?: string;
  name?: string;
  fetcher?: (url: string) => Promise<Response>;
  connector?: GitHubConnector;
}

/**
 * Rewrite a GitHub API URL to the read-only proxy route so the PAT never
 * reaches the browser (design: proxy `src/app/api/github/[...path]`).
 */
export function proxyFetcher(url: string): Promise<Response> {
  const path = url.startsWith(GITHUB_API_ORIGIN) ? url.slice(GITHUB_API_ORIGIN.length) : url;
  return fetch(`/api/github${path}`);
}

/**
 * Read-only sync mutation. Runs the `GitHubConnector`'s one-way import and
 * invalidates every derived read so the board/backlog/detail reflect the new
 * mirror. Local cards are intentionally NOT invalidated — sync never touches
 * them.
 */
export function useSync(options: SyncOptions = {}) {
  const queryClient = useQueryClient();

  const connector = useMemo(
    () => options.connector ?? buildDefaultConnector(options),
    [options.connector, options.owner, options.name, options.fetcher],
  );

  return useMutation({
    mutationFn: () => connector.sync(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.issueDetail });
    },
  });
}

function buildDefaultConnector(options: SyncOptions): GitHubConnector {
  return new GitHubConnector({
    owner: options.owner ?? DEFAULT_REPO.owner,
    name: options.name ?? DEFAULT_REPO.name,
    fetcher: options.fetcher ?? proxyFetcher,
    store: githubItemRepo,
  });
}
