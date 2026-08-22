import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export type InputVariant = "default" | "search";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * "search" adds left padding (pl-8) to accommodate a leading icon placed
   * by the caller; "default" uses standard symmetric padding.
   */
  variant?: InputVariant;
}

/**
 * Canonical Input primitive for MeperBoard. Replaces the scattered
 * searchClassName / editorInputClassName strings in backlog.tsx.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = "default", className, ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border bg-card py-1.5 text-sm text-foreground",
          "shadow-xs transition-colors duration-150",
          "placeholder:text-muted-foreground/70",
          "hover:border-foreground/20",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          variant === "search" ? "pl-8 pr-3" : "px-3",
          className,
        )}
        {...rest}
      />
    );
  },
);

Input.displayName = "Input";
