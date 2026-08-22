export type AccentId =
  | "cyber-lime"
  | "terracotta"
  | "jade-teal"
  | "cyber-amber"
  | "tokyo-night"
  | "rose-pine"
  | "crimson-coral"
  | "monochrome";

export interface AccentTheme {
  id: AccentId;
  label: string;
  swatch: string;
  description: string;
}

export const ACCENT_STORAGE_KEY = "meperboard-accent";
export const DEFAULT_ACCENT: AccentId = "cyber-lime";

export const ACCENT_THEMES: readonly AccentTheme[] = [
  {
    id: "cyber-lime",
    label: "Cyber Lime",
    swatch: "#a3e635",
    description: "High-energy lime & acid olive",
  },
  {
    id: "terracotta",
    label: "Terracotta Copper",
    swatch: "#c25e36",
    description: "Kinetic Bento warm copper",
  },
  {
    id: "jade-teal",
    label: "Jade Teal",
    swatch: "#14b8a6",
    description: "Deep petrol & ocean jade",
  },
  {
    id: "cyber-amber",
    label: "Cyber Amber",
    swatch: "#f59e0b",
    description: "Industrial amber & warm ochre",
  },
  {
    id: "tokyo-night",
    label: "Tokyo Indigo",
    swatch: "#828fff",
    description: "Tokyo night indigo & lavender",
  },
  {
    id: "rose-pine",
    label: "Rose Quartz",
    swatch: "#fb7185",
    description: "Rose pine & warm berry",
  },
  {
    id: "crimson-coral",
    label: "Neo Coral",
    swatch: "#f43f5e",
    description: "Vermilion & high-tech coral",
  },
  {
    id: "monochrome",
    label: "Titanium Pure",
    swatch: "#e2e8f0",
    description: "Minimalist swiss grayscale",
  },
] as const;

export function loadStoredAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY) as AccentId | null;
    if (stored && ACCENT_THEMES.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable
  }
  return DEFAULT_ACCENT;
}

export function saveStoredAccent(accent: AccentId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Storage unavailable
  }
}

export function applyAccentToDom(accent: AccentId): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.accent = accent;
}
