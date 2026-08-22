import { useId, type ReactNode } from "react";

import { cn } from "../../lib/utils";

export interface TooltipProps {
  /** Text content of the tooltip. */
  content: string;
  /** The element that triggers the tooltip on hover/focus. */
  children: ReactNode;
  /** Optional additional class for the tooltip bubble. */
  className?: string;
}

/**
 * Lightweight CSS-based Tooltip. No external dependencies, no portals.
 *
 * The trigger element receives aria-describedby pointing to the tooltip
 * content. The tooltip itself is hidden at rest (opacity-0 pointer-events-none)
 * and revealed on group-hover or when the trigger is focused.
 *
 * Usage:
 *   <Tooltip content="Description">
 *     <button>...</button>
 *   </Tooltip>
 *
 * Limitation: the tooltip always appears above the trigger. For edge cases
 * with overflow constraints, pass className to override positioning.
 */
export function Tooltip({ content, children, className }: TooltipProps) {
  const id = useId();

  return (
    <div className="group relative inline-flex">
      {/* Trigger — aria-describedby wires the tooltip text for screen readers */}
      <div aria-describedby={id} className="inline-flex">
        {children}
      </div>
      {/* Tooltip bubble — visible on group hover or focus-within */}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2",
          "rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm",
          "opacity-0 transition-opacity duration-150",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          "whitespace-nowrap",
          className,
        )}
      >
        {content}
      </span>
    </div>
  );
}
