/**
 * Local storage manager for recently accessed / toggled repositories.
 */

export const RECENT_REPOS_STORAGE_KEY = "meperboard:recent-repos";
export const MAX_RECENT_REPOS = 5;

/**
 * Load recent repository IDs from localStorage.
 */
export function loadRecentRepos(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_REPOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    // Local storage unavailable or malformed
  }
  return [];
}

/**
 * Push a repository ID to the front of recent repositories, deduplicating and capping.
 */
export function saveRecentRepo(repoId: string): string[] {
  if (typeof window === "undefined" || !repoId) return [];
  try {
    const current = loadRecentRepos();
    const updated = [repoId, ...current.filter((id) => id.toLowerCase() !== repoId.toLowerCase())].slice(
      0,
      MAX_RECENT_REPOS,
    );
    window.localStorage.setItem(RECENT_REPOS_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    // Local storage write error
    return [];
  }
}
