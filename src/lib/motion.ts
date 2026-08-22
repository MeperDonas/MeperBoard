/**
 * Centralized motion constants for MeperBoard.
 * Import from here — never define inline spring configs in components.
 */

/** Layout animations: card flights between columns. */
export const SPRING_CARD_FLIGHT = {
  type: "spring",
  stiffness: 500,
  damping: 40,
  mass: 0.9,
} as const;

/** Drag overlay pickup: snappier than layout flights. */
export const SPRING_GHOST_LIFT = {
  type: "spring",
  stiffness: 700,
  damping: 35,
  mass: 0.7,
} as const;

/** Rail collapse / expand. */
export const SPRING_RAIL = {
  type: "spring",
  stiffness: 400,
  damping: 34,
  mass: 0.9,
} as const;

/** Toast enter/exit easing. */
export const EASE_TOAST = {
  duration: 0.18,
  ease: "easeOut" as const,
};
