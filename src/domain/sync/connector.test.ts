import { describe, expect, it, vi } from "vitest";

import type { GithubItem } from "../../data/types";
import { GitHubConnector, parseNextLink } from "./connector";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const issuePayload = {
  number: 1,
  title: "Add login",
  body: null,
  state: "open",
  html_url: "https://github.com/meperdonas/meperboard/issues/1",
  updated_at: "2026-08-01T00:00:00Z",
  labels: [],
};

function makeStore() {
  return { bulkUpsert: vi.fn<(items: GithubItem[]) => Promise<void>>().mockResolvedValue(undefined) };
}

describe("parseNextLink", () => {
  it("extracts the rel=next URL from a Link header", () => {
    const link =
      '<https://api.github.com/repos/a/b/issues?page=2>; rel="next", ' +
      '<https://api.github.com/repos/a/b/issues?page=1>; rel="prev"';
    expect(parseNextLink(link)).toBe("https://api.github.com/repos/a/b/issues?page=2");
  });

  it("returns null when no next link is present", () => {
    expect(parseNextLink('<https://api.github.com/repos/a/b/issues?page=1>; rel="prev"')).toBeNull();
    expect(parseNextLink(null)).toBeNull();
  });
});

describe("GitHubConnector", () => {
  it("fetches, maps, and upserts issues+pulls in one sync", async () => {
    const store = makeStore();
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse([
        issuePayload,
        { ...issuePayload, number: 2, title: "Fix auth", pull_request: { url: "https://api.github.com/pulls/2" } },
      ]),
    );
    const connector = new GitHubConnector({
      owner: "meperdonas",
      name: "meperboard",
      fetcher,
      store,
      now: () => "2026-08-15T00:00:00Z",
    });

    const result = await connector.sync();

    expect(result).toEqual({ imported: 2, paused: false });
    expect(store.bulkUpsert).toHaveBeenCalledTimes(1);
    const items = store.bulkUpsert.mock.calls[0][0];
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ repo: "meperdonas/meperboard", number: 1, kind: "issue" });
    expect(items[1]).toMatchObject({ repo: "meperdonas/meperboard", number: 2, kind: "pull" });
  });

  it("imports an empty dataset without error when the repo has no issues", async () => {
    const store = makeStore();
    const fetcher = vi.fn().mockImplementation(() => jsonResponse([]));
    const connector = new GitHubConnector({ owner: "o", name: "n", fetcher, store });

    const result = await connector.sync();

    expect(result).toEqual({ imported: 0, paused: false });
    expect(store.bulkUpsert).not.toHaveBeenCalled();
  });

  it("follows pagination across Link next pages", async () => {
    const store = makeStore();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([issuePayload]), {
          status: 200,
          headers: { link: '<https://api.github.com/page/2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...issuePayload, number: 2 }]), { status: 200 }));
    const connector = new GitHubConnector({ owner: "o", name: "n", fetcher, store });

    await connector.sync();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][0]).toBe("https://api.github.com/page/2");
  });

  it("leaves the prior dataset intact when fetching fails", async () => {
    const store = makeStore();
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const connector = new GitHubConnector({ owner: "o", name: "n", fetcher, store });

    await expect(connector.sync()).rejects.toThrow("network down");
    expect(store.bulkUpsert).not.toHaveBeenCalled();
  });

  it("re-syncs with stable {repo,number} keys (update in place, no duplicates)", async () => {
    const store = makeStore();
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        jsonResponse([issuePayload, { ...issuePayload, number: 2, title: "Other" }]),
      );
    const connector = new GitHubConnector({
      owner: "meperdonas",
      name: "meperboard",
      fetcher,
      store,
      now: () => "2026-08-15T00:00:00Z",
    });

    await connector.sync();
    await connector.sync();

    expect(store.bulkUpsert).toHaveBeenCalledTimes(2);
    const first = store.bulkUpsert.mock.calls[0][0];
    const second = store.bulkUpsert.mock.calls[1][0];
    const keys = (items: GithubItem[]) => items.map((item) => `${item.repo}#${item.number}`);

    // Both batches map to the exact same compound keys, so a real Dexie
    // bulkPut updates rows in place rather than appending duplicates.
    expect(keys(first)).toEqual(["meperdonas/meperboard#1", "meperdonas/meperboard#2"]);
    expect(keys(second)).toEqual(["meperdonas/meperboard#1", "meperdonas/meperboard#2"]);
  });
});
