import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { repoRepo } from "../../data/repositories";
import { createTestQueryClient, queryWrapper, resetDb } from "../../state/test-utils";
import { OPEN_REPO_SWITCHER_EVENT, RepoSwitcher } from "./repo-switcher";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

type FetchHandler = (init?: RequestInit) => Response;

function mockFetch(handlers: Record<string, FetchHandler>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const handler = handlers[url];
    if (!handler) return jsonResponse({ error: "not found" }, 404);
    return handler(init);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const liveRepos = [
  { full_name: "meperdonas/meperboard", name: "meperboard", owner: { login: "meperdonas" } },
  { full_name: "acme/widgets", name: "widgets", owner: { login: "acme" } },
  { full_name: "meperdonas/meperpos", name: "meperpos", owner: { login: "meperdonas" } },
];

function openSwitcher() {
  fireEvent(
    window,
    new CustomEvent(OPEN_REPO_SWITCHER_EVENT),
  );
}

describe("RepoSwitcher", () => {
  let client: ReturnType<typeof createTestQueryClient>;

  beforeEach(async () => {
    await resetDb();
    client = createTestQueryClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens on the event and lists live repos from the proxy", async () => {
    mockFetch({ "/api/github/user/repos": () => jsonResponse(liveRepos) });

    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });

    expect(screen.queryByRole("dialog", { name: /switch repository/i })).not.toBeInTheDocument();

    openSwitcher();

    expect(screen.getByRole("dialog", { name: /switch repository/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /meperdonas\/meperboard/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: /acme\/widgets/i })).toBeInTheDocument();
  });

  it("does not fetch live repos until it opens", async () => {
    const fetchMock = mockFetch({ "/api/github/user/repos": () => jsonResponse(liveRepos) });

    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });

    // Fetch is lazy: no proxy call before the switcher opens.
    expect(fetchMock).not.toHaveBeenCalledWith("/api/github/user/repos");

    openSwitcher();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/github/user/repos"),
    );
  });

  it("filters repos with fuzzy search by owner/name", async () => {
    mockFetch({ "/api/github/user/repos": () => jsonResponse(liveRepos) });
    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });
    openSwitcher();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /acme\/widgets/i })).toBeInTheDocument(),
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "widgets" } });

    expect(screen.getByRole("option", { name: /acme\/widgets/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /meperdonas\/meperboard/i })).not.toBeInTheDocument();
  });

  it("toggles the clicked repo as active and allows multi-select", async () => {
    mockFetch({ "/api/github/user/repos": () => jsonResponse(liveRepos) });
    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });
    openSwitcher();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /acme\/widgets/i })).toBeInTheDocument(),
    );

    // Toggle acme/widgets ON
    fireEvent.click(screen.getByRole("option", { name: /acme\/widgets/i }));

    await waitFor(() =>
      expect(repoRepo.getActiveRepos()).resolves.toEqual([
        expect.objectContaining({ id: "acme/widgets", is_active: true }),
      ]),
    );

    // Dialog stays open so user can pick another repo
    expect(screen.getByRole("dialog", { name: /switch repository/i })).toBeInTheDocument();

    // Toggle meperdonas/meperboard ON as well
    fireEvent.click(screen.getByRole("option", { name: /meperdonas\/meperboard/i }));

    await waitFor(async () => {
      const active = await repoRepo.getActiveRepos();
      expect(active).toHaveLength(2);
    });

    // Close via Done button
    fireEvent.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /switch repository/i })).not.toBeInTheDocument(),
    );
  });

  it("shows an error state when the live repo list fails", async () => {
    mockFetch({ "/api/github/user/repos": () => jsonResponse({ error: "no auth" }, 401) });
    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });
    openSwitcher();

    expect(await screen.findByText(/failed to load repositories/i)).toBeInTheDocument();
  });

  it("renders a Recent section when recent repositories exist in storage", async () => {
    window.localStorage.setItem(
      "meperboard:recent-repos",
      JSON.stringify(["meperdonas/meperboard"]),
    );
    mockFetch({ "/api/github/user/repos": () => jsonResponse(liveRepos) });

    render(<RepoSwitcher />, { wrapper: queryWrapper(client) });
    openSwitcher();

    await waitFor(() =>
      expect(screen.getByText("Recent")).toBeInTheDocument(),
    );
    expect(screen.getByText("All Repositories")).toBeInTheDocument();
  });
});
