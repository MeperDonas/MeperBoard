"use client";

import { ChevronDown, FolderGit2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { DEFAULT_REPO, useActiveRepos } from "../../state";
import { OPEN_REPO_SWITCHER_EVENT } from "./repo-switcher";

export function RepoButton() {
  const activeRepos = useActiveRepos();
  const repos = activeRepos.data ?? [];

  let repoLabel: string;
  if (repos.length === 0) {
    repoLabel = `${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;
  } else if (repos.length === 1) {
    repoLabel = `${repos[0].owner}/${repos[0].name}`;
  } else {
    repoLabel = `${repos[0].name} +${repos.length - 1}`;
  }

  function handleOpen() {
    window.dispatchEvent(new CustomEvent(OPEN_REPO_SWITCHER_EVENT));
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      title={`Active repositories: ${repos.map((r) => r.id).join(", ") || repoLabel} (Click to switch)`}
      aria-label={`Active repository: ${repoLabel}. Click to switch repository.`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium text-foreground shadow-xs transition-colors duration-150",
        "hover:border-primary/50 hover:bg-accent/50",
      )}
    >
      <FolderGit2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      <span className="max-w-28 truncate font-mono text-[11px] sm:max-w-44">{repoLabel}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
