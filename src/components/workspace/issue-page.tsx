"use client";

import { DEFAULT_REPO } from "../../state";
import { AppHeader } from "../app-header/app-header";
import { IssueDetail } from "../issue-detail";

/** The issue-detail page composition for a mirrored GitHub issue number. */
export function IssuePage({ number }: { number: number }) {
  const repo = `${DEFAULT_REPO.owner}/${DEFAULT_REPO.name}`;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <IssueDetail repo={repo} number={number} />
    </div>
  );
}
