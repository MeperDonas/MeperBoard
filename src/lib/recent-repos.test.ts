import { beforeEach, describe, expect, it } from "vitest";

import {
  loadRecentRepos,
  MAX_RECENT_REPOS,
  RECENT_REPOS_STORAGE_KEY,
  saveRecentRepo,
} from "./recent-repos";

describe("recent-repos", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns empty array when nothing is stored", () => {
    expect(loadRecentRepos()).toEqual([]);
  });

  it("saves and loads a recent repository ID", () => {
    saveRecentRepo("MeperDonas/MeperBoard");
    expect(loadRecentRepos()).toEqual(["MeperDonas/MeperBoard"]);
  });

  it("moves duplicate repo to the front", () => {
    saveRecentRepo("repo/one");
    saveRecentRepo("repo/two");
    saveRecentRepo("repo/one");
    expect(loadRecentRepos()).toEqual(["repo/one", "repo/two"]);
  });

  it("caps to MAX_RECENT_REPOS items", () => {
    for (let i = 1; i <= 10; i++) {
      saveRecentRepo(`repo/${i}`);
    }
    const recents = loadRecentRepos();
    expect(recents).toHaveLength(MAX_RECENT_REPOS);
    expect(recents[0]).toBe("repo/10");
  });

  it("handles malformed JSON gracefully", () => {
    window.localStorage.setItem(RECENT_REPOS_STORAGE_KEY, "invalid json");
    expect(loadRecentRepos()).toEqual([]);
  });
});
