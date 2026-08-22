import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// jsdom lacks the browser APIs framer-motion relies on (layout measurement and
// media queries). Provide inert stand-ins so motion code paths run headlessly.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: (): void => {},
      removeListener: (): void => {},
      addEventListener: (): void => {},
      removeEventListener: (): void => {},
      dispatchEvent: (): boolean => false,
    }),
  });
}

// Vitest does not expose `afterEach` as a global (no `globals: true`), so
// @testing-library/react cannot auto-register cleanup. Register it here so
// each test's rendered tree is torn down and DOM queries don't leak between
// tests.
afterEach(() => {
  cleanup();
});
