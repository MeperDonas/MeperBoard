import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyThemeToDom,
  loadTheme,
} from "./theme-preference";

describe("theme-preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to dark when nothing is stored", () => {
    expect(loadTheme()).toBe(DEFAULT_THEME);
    expect(DEFAULT_THEME).toBe("dark");
  });

  it("reloads a stored theme preference", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    expect(loadTheme()).toBe("light");
  });

  it("applies the dark theme by toggling the root class and persisting it", () => {
    applyThemeToDom("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("applies the light theme by clearing the root class and persisting it", () => {
    applyThemeToDom("dark");
    applyThemeToDom("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
