import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPO_COLOR,
  getRepoColorScheme,
  getRepoShortName,
  REPO_COLOR_PALETTES,
} from "./repo-colors";

describe("repo-colors", () => {
  describe("getRepoColorScheme", () => {
    it("returns default color when repoId is null or undefined", () => {
      expect(getRepoColorScheme(null)).toEqual(DEFAULT_REPO_COLOR);
      expect(getRepoColorScheme(undefined)).toEqual(DEFAULT_REPO_COLOR);
      expect(getRepoColorScheme("")).toEqual(DEFAULT_REPO_COLOR);
    });

    it("returns a valid palette for a given repository ID", () => {
      const scheme = getRepoColorScheme("MeperDonas/MeperBoard");
      expect(REPO_COLOR_PALETTES).toContainEqual(scheme);
      expect(scheme.dot).toBeDefined();
      expect(scheme.badge).toBeDefined();
      expect(scheme.bar).toBeDefined();
    });

    it("is deterministic for the same repository ID", () => {
      const first = getRepoColorScheme("acme/widgets");
      const second = getRepoColorScheme("acme/widgets");
      expect(first).toEqual(second);
    });

    it("distributes different repos to potentially different palettes", () => {
      const scheme1 = getRepoColorScheme("repo/alpha");
      const scheme2 = getRepoColorScheme("repo/beta");
      expect(scheme1).toBeDefined();
      expect(scheme2).toBeDefined();
    });
  });

  describe("getRepoShortName", () => {
    it("returns null for null or empty repoId", () => {
      expect(getRepoShortName(null)).toBeNull();
      expect(getRepoShortName("")).toBeNull();
    });

    it("extracts the repo name without owner", () => {
      expect(getRepoShortName("MeperDonas/MeperBoard")).toBe("MeperBoard");
      expect(getRepoShortName("acme/my-service")).toBe("my-service");
    });

    it("returns the full string if there is no slash", () => {
      expect(getRepoShortName("standalone-project")).toBe("standalone-project");
    });
  });
});
