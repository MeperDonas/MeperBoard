"use client";

import type { ReactNode } from "react";

import type { GithubItem, RepoId } from "../../data/types";
import { useIssueDetail } from "../../state";

export interface IssueDetailProps {
  /** Mirrored repo id (e.g. "owner/name"); `undefined` means nothing selected. */
  repo?: RepoId;
  /** GitHub issue/PR number; `undefined` means nothing selected. */
  number?: number;
}

const KIND_LABEL: Record<string, string> = {
  issue: "Issue",
  pull: "Pull request",
};

/**
 * Read-only detail for a selected GitHub issue or pull request.
 *
 * Shows title, type, state, labels, body, and linked PRs with placeholders for
 * empty fields. It renders no buttons, inputs, or selects — there is no way to
 * create, edit, close, or re-label from this view (spec issue-detail).
 */
export function IssueDetail({ repo, number }: IssueDetailProps) {
  const { data, isPending, isError } = useIssueDetail(repo, number);

  if (repo == null || number == null) {
    return <DetailStatus>Select an issue to view its details.</DetailStatus>;
  }
  if (isPending) {
    return <DetailStatus>Loading issue…</DetailStatus>;
  }
  if (isError) {
    return <DetailStatus>Failed to load the issue.</DetailStatus>;
  }
  if (!data) {
    return <DetailStatus>Issue not found.</DetailStatus>;
  }

  return <IssueDetailView item={data} />;
}

function IssueDetailView({ item }: { item: GithubItem }) {
  const kind = KIND_LABEL[item.kind] ?? item.kind;

  return (
    <article className="p-4" role="region" aria-label="Issue details">
      <header className="mb-4 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">{item.title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {kind}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-full border px-2 py-0.5 text-xs">{formatState(item.state)}</span>
          <span className="tabular-nums">#{item.number}</span>
          {item.html_url && (
            <a
              href={item.html_url}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Open on GitHub
            </a>
          )}
        </div>
      </header>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Labels</h3>
        {item.labels.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No labels.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {item.labels.map((label) => (
              <li
                key={label}
                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
              >
                {label}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Description</h3>
        {item.body.trim() === "" ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No description provided.</p>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap text-sm">{item.body}</p>
        )}
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Linked pull requests</h3>
        {item.linked_prs.length === 0 ? (
          <p className="mt-1.5 text-sm text-muted-foreground">No linked pull requests.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {item.linked_prs.map((pr) => (
              <li key={pr} className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">
                #{pr}
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function DetailStatus({ children }: { children: ReactNode }) {
  return <p className="p-4 text-sm text-muted-foreground">{children}</p>;
}

function formatState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}
