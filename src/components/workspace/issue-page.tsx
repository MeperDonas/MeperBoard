"use client";

import { DEFAULT_REPO, useActiveRepos } from "../../state";
import { AppHeader } from "../app-header/app-header";
import { IssueDetail } from "../issue-detail";

/** The issue-detail page composition for a mirrored GitHub issue number. */
export function IssuePage({ repo, number }: { repo?: string; number: number }) {
  const activeRepos = useActiveRepos();
  const defaultRepoId = `${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;
  const targetRepo = repo ?? activeRepos.data?.[0]?.id ?? defaultRepoId;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <IssueDetail repo={targetRepo} number={number} />
    </div>
  );
}
