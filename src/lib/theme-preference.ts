/**
 * Dark/light theme preference. Centralizes the storage key and the DOM + storage
 * write so the `ThemeToggle`, the ⌘K palette's theme commands, and the theme init
 * script share one source of truth. Any consumer that switches the theme calls
 * `applyThemeToDom` rather than toggling classes inline.
 */

export type ThemePreference = "dark" | "light";

/** Keep in sync with the theme init script in app/layout.tsx. */
export const THEME_STORAGE_KEY = "meperboard-theme";

/** MeperBoard's default theme is dark (matches the init script fallback). */
export const DEFAULT_THEME: ThemePreference = "dark";

/** Read the persisted preference; default to dark when absent/unavailable. */
export function loadTheme(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage unavailable (private mode, quota).
  }
  return DEFAULT_THEME;
}

/**
 * Apply a theme to the document root and persist the explicit choice. Toggling
 * the `dark` class on `<html>` is the app's theme mechanism (the init script
 * reads/writes the same class), so this is the single write path.
 */
export function applyThemeToDom(theme: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Still apply the theme for the session even if persistence fails.
  }
}
