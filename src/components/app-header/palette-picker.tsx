"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "../../lib/utils";
import {
  ACCENT_THEMES,
  applyAccentToDom,
  loadStoredAccent,
  saveStoredAccent,
  type AccentId,
} from "../../lib/themes";

export function PalettePicker() {
  const reduceMotion = useReducedMotion() ?? false;
  const [activeAccent, setActiveAccent] = useState<AccentId>("cyber-lime");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const current = loadStoredAccent();
    setActiveAccent(current);
    applyAccentToDom(current);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(id: AccentId) {
    setActiveAccent(id);
    applyAccentToDom(id);
    saveStoredAccent(id);
    setOpen(false);
  }

  const currentTheme = ACCENT_THEMES.find((t) => t.id === activeAccent) ?? ACCENT_THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={`Change accent palette (Current: ${currentTheme.label})`}
        aria-label={`Change accent palette (Current: ${currentTheme.label})`}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-lg border bg-card px-2 text-xs font-medium text-muted-foreground shadow-xs transition-colors duration-150",
          "hover:border-foreground/20 hover:text-foreground",
          open && "border-primary/60 text-foreground",
        )}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shadow-xs ring-1 ring-border/80"
          style={{ backgroundColor: currentTheme.swatch }}
          aria-hidden="true"
        />
        <Palette className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          role="listbox"
          aria-label="Color palettes"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border bg-popover/95 p-1.5 text-popover-foreground shadow-2xl backdrop-blur-md ring-1 ring-border/50"
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Theme Palettes
          </div>
          <div className="flex flex-col gap-0.5">
            {ACCENT_THEMES.map((theme) => {
              const isSelected = theme.id === activeAccent;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(theme.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors duration-100",
                    "hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/70 font-semibold text-foreground",
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full shadow-xs ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: theme.swatch }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{theme.label}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{theme.description}</p>
                  </div>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
