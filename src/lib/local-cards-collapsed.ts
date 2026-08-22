/**
 * Persistence for the Local Cards rail collapse state (UX round 3). Kept in
 * localStorage under a stable key; SSR and private-mode failures fall back to
 * the default (expanded) without throwing.
 */

const STORAGE_KEY = "meperboard-localcards-collapsed";

/** Read the persisted collapse state; default is expanded (`false`). */
export function loadLocalCardsCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Persist the collapse state; storage errors are swallowed by design. */
export function saveLocalCardsCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Private browsing / quota errors must never break the toggle.
  }
}
