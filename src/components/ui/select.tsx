"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "../../lib/utils";

/**
 * Custom popover select (UX round 3) — replaces every OS-native `<select>` so
 * the popup matches the app's Linear-style tokens in both themes.
 *
 * A11y follows the combobox/listbox pattern with `aria-activedescendant`:
 * keyboard focus stays on the trigger while the panel is open, and the active
 * option is announced through the trigger. Full keyboard support: Enter/Space/
 * ArrowDown/ArrowUp open, arrows navigate, Home/End jump, typeahead jumps to
 * matching labels, Enter/Space select, Escape closes and restores focus, Tab
 * closes without selecting, click-outside closes.
 *
 * Deliberately NO exit animation: closing unmounts the panel immediately, so
 * RTL "not.toBeInTheDocument" assertions never race a fade-out (round-2
 * lesson). The mount animation alone is gated on `useReducedMotion`, because
 * framer-motion ignores CSS `prefers-reduced-motion` kill blocks.
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name for the combobox (tests use it via getByRole name). */
  "aria-label": string;
  id?: string;
  /** Compact variant used inside inline editors/forms. */
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
}

const TRIGGER_BASE =
  "inline-flex items-center justify-between gap-2 rounded-lg border bg-card text-sm text-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20 data-[open=true]:border-primary/60";
const TRIGGER_MD = "py-1.5 pl-3 pr-2.5";
const TRIGGER_SM = "py-1 pl-2 pr-1.5 text-xs";

const PANEL_MOTION = { duration: 0.14, ease: "easeOut" as const };

/** Idle window after which a typeahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

export function Select({
  options,
  value,
  onValueChange,
  size = "md",
  disabled = false,
  className,
  ...ariaAndId
}: SelectProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const typeaheadRef = useRef<{ buffer: string; at: number }>({ buffer: "", at: 0 });
  const uid = useId();
  const listboxId = `${uid}-listbox`;

  const selectedIndex = useMemo(
    () => Math.max(0, options.findIndex((option) => option.value === value)),
    [options, value],
  );
  const selectedOption = options[selectedIndex];

  // Close on pointer-down outside; also restore focus to the trigger when the
  // dismissal came from the keyboard (Escape) or an outside click.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  // Keep the active option visible while roving with the keyboard.
  useEffect(() => {
    if (!open) return;
    const node = document.getElementById(optionId(listboxId, activeIndex));
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex, listboxId]);

  if (options.length === 0 || selectedOption == null) return null;

  function openPanel(fromIndex: number) {
    typeaheadRef.current = { buffer: "", at: 0 };
    setActiveIndex(Math.min(Math.max(0, fromIndex), options.length - 1));
    setOpen(true);
  }

  function selectIndex(index: number) {
    const option = options[index];
    if (!option) return;
    if (option.value !== value) onValueChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function closePanel(refocus: boolean) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  /** Typeahead: prefer matches after the active option, wrapping around. */
  function typeahead(char: string) {
    const now = Date.now();
    const previous = typeaheadRef.current;
    const buffer =
      now - previous.at <= TYPEAHEAD_RESET_MS ? `${previous.buffer}${char}` : char;
    typeaheadRef.current = { buffer, at: now };

    const needle = buffer.toLowerCase();
    const order = Array.from({ length: options.length }, (_, offset) =>
      (activeIndex + 1 + offset) % options.length,
    );
    let match = order.find((index) => options[index].label.toLowerCase().startsWith(needle));

    // No full-buffer match? Retry with just the newest character.
    if (match == null && buffer.length > 1) {
      typeaheadRef.current = { buffer: char, at: now };
      match = order.find((index) => options[index].label.toLowerCase().startsWith(char));
    }
    if (match != null) setActiveIndex(match);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (
        event.key === "Enter" ||
        event.key === " " ||
        event.key === "ArrowDown" ||
        event.key === "ArrowUp"
      ) {
        event.preventDefault();
        openPanel(selectedIndex);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setActiveIndex((current) => Math.min(options.length - 1, current + 1));
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setActiveIndex((current) => Math.max(0, current - 1));
        break;
      }
      case "Home": {
        event.preventDefault();
        setActiveIndex(0);
        break;
      }
      case "End": {
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      }
      case "Enter":
      case " ": {
        event.preventDefault();
        selectIndex(activeIndex);
        break;
      }
      case "Escape": {
        event.preventDefault();
        closePanel(true);
        break;
      }
      case "Tab": {
        // Close without selecting; allow the default tab traversal.
        closePanel(false);
        break;
      }
      default: {
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          typeahead(event.key);
        }
      }
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        {...ariaAndId}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open ? optionId(listboxId, activeIndex) : undefined
        }
        aria-autocomplete="list"
        disabled={disabled}
        data-open={open}
        onClick={() => (open ? closePanel(false) : openPanel(selectedIndex))}
        onKeyDown={handleTriggerKeyDown}
        className={cn(TRIGGER_BASE, size === "sm" ? TRIGGER_SM : TRIGGER_MD, "w-full cursor-pointer")}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={PANEL_MOTION}
          role="listbox"
          id={listboxId}
          aria-label={ariaAndId["aria-label"]}
          className="absolute left-0 top-full z-50 mt-1 w-max min-w-full max-w-72 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          style={{ transformOrigin: "top center" }}
        >
          {options.map((option, index) => {
            const isSelected = index === selectedIndex;
            const isActive = index === activeIndex;
            return (
              <div
                key={option.value}
                id={optionId(listboxId, index)}
                role="option"
                aria-selected={isSelected}
                data-active={isActive}
                onPointerMove={() => setActiveIndex(index)}
                onClick={(event) => {
                  event.stopPropagation();
                  selectIndex(index);
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm transition-colors duration-100",
                  isActive ? "bg-accent text-accent-foreground" : null,
                  isSelected ? "text-primary" : null,
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function optionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}
