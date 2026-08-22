"use client";

import { ChevronDown, FolderGit2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { DEFAULT_REPO, useActiveRepo } from "../../state";
import { OPEN_REPO_SWITCHER_EVENT } from "./repo-switcher";

export function RepoButton() {
  const activeRepo = useActiveRepo();
  const repoLabel = activeRepo.data
    ? `${activeRepo.data.owner}/${activeRepo.data.name}`
    : `${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;

  function handleOpen() {
    window.dispatchEvent(new CustomEvent(OPEN_REPO_SWITCHER_EVENT));
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      title={`Active repository: ${repoLabel} (Click to switch)`}
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
