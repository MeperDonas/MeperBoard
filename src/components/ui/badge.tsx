import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

/**
 * The single shared badge/tag primitive (UX round 2). Variants are driven by
 * the Linear design tokens in globals.css — never hardcode colors here.
 */
export type BadgeVariant = "neutral" | "primary" | "accent" | "outline" | "success" | "warning";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary text-primary-foreground",
  accent: "border border-primary/30 bg-primary/10 text-primary font-medium",
  outline: "border border-primary/20 bg-primary/[0.03] text-foreground/90 transition-colors",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * Dense pill used for kinds, states, numbers, and dates across board cards and
 * backlog rows. `inline-flex` + `gap-1` lets callers compose an icon with a
 * label without extra wrappers.
 */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
