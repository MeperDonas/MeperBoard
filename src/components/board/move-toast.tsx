import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Undo2 } from "lucide-react";
import { useEffect } from "react";

import { EASE_TOAST } from "../../lib/motion";

/**
 * Bottom-center undo toast for board column moves (UX round 2). Announced via
 * a polite live region, auto-dismisses after 5s, and animates through
 * framer-motion — which bypasses CSS `prefers-reduced-motion` kill blocks, so
 * `useReducedMotion` gates the animation explicitly.
 */

export interface MoveToastState {
  /** Changes on every new move so re-triggering restarts timer + animation. */
  key: number;
  cardId: string;
  title: string;
  fromColumnId: string;
}

export interface MoveToastProps {
  toast: MoveToastState | null;
  onUndo: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function MoveToast({ toast, onUndo, onDismiss }: MoveToastProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            transition={EASE_TOAST}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-elevated px-3.5 py-2.5 shadow-lg"
          >
            <span className="text-sm text-foreground">
              {"Moved '"}
              <span className="font-medium">{toast.title}</span>
              {"'"}
            </span>
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Undo move of ${toast.title}`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
