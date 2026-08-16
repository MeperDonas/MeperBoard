import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";

// Vitest does not expose `afterEach` as a global (no `globals: true`), so
// @testing-library/react cannot auto-register cleanup. Register it here so
// each test's rendered tree is torn down and DOM queries don't leak between
// tests.
afterEach(() => {
  cleanup();
});
