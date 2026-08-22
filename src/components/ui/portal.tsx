"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface PortalProps {
  children: ReactNode;
}

/**
 * Renders children into `document.body` to break out of containing blocks
 * created by CSS `transform`, `filter`, or `backdrop-filter` in parent elements.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}
