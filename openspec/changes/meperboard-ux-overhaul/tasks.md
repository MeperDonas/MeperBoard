# Tasks: meperboard-ux-overhaul

<!-- Each task maps to one or more REQ-NNN from spec.md. Check off as work completes. -->

## Phase 1 — Design System Hardening

- [x] T01: Create src/components/ui/button.tsx with primary/secondary/ghost/destructive variants (REQ-003)
- [x] T02: Create src/components/ui/input.tsx with single canonical input style (REQ-004)
- [x] T03: Create src/components/ui/tooltip.tsx as a lightweight wrapper component (REQ-006, REQ-010)
- [x] T04: Export formatState from src/components/ui/card-meta.tsx (REQ-005)
- [x] T05: Remove duplicate formatState from src/components/issue-detail/issue-detail.tsx and import from card-meta.tsx (REQ-005)
- [x] T06: Replace raw label li elements in IssueDetailView with Badge variant="outline" (REQ-006)
- [x] T07: Add shadow-md -> --elevation-2 alias in src/app/globals.css (REQ-023 related)
- [x] T08: Add outline-offset: 3px rule for rounded-full:focus-visible in globals.css (REQ-023)
- [x] T09: Create src/lib/motion.ts with SPRING_CARD_FLIGHT, SPRING_GHOST_LIFT, SPRING_RAIL, EASE_TOAST (REQ-020)

## Phase 2 — Layout & Scroll Architecture

- [x] T10: Constrain BoardWorkspace root to h-screen flex flex-col overflow-hidden — remove min-h-screen (REQ-001)
- [x] T11: Add flex-1 min-h-0 overflow-hidden to board content area below toolbar in BoardWorkspace (REQ-001)
- [x] T12: Add overflow-x-auto h-full to the column list wrapper div in Board (REQ-001, REQ-002)
- [x] T13: Add overflow-y-auto and max-height to BoardColumn ul (card list) for per-column scroll (REQ-002)
- [x] T14: Define --board-col-max-height CSS custom property on board root element (REQ-002)
- [x] T15: Remove Show N more expand pattern from board.tsx (superseded by per-column scroll) (REQ-002)

## Phase 3 — App Header & Sync Toolbar

- [x] T16: Update active nav indicator in app-header.tsx: remove bg-accent, add accent bottom border 2px (REQ-011)
- [x] T17: Animate ThemeToggle icon swap with scale+opacity transition in theme-toggle.tsx (REQ-012)
- [x] T18: Replace Sync button inline classes with Button secondary variant in board-workspace.tsx (REQ-013)
- [x] T19: Add icon feedback to sync status text: Clock/CheckCircle/AlertCircle based on sync state (REQ-014)
- [x] T20: Add visible text label to RailToggle: "Local (N)" when expanded, "Local" when collapsed (REQ-015)
- [x] T21: Replace RailToggle inline button classes with Button ghost/secondary variant (REQ-003)

## Phase 4 — Board & Card UX

- [x] T22: Add group class to BoardCard motion.li; add opacity-0 group-hover:opacity-100 to drag handle (REQ-007)
- [x] T23: Wrap move button row (border-t + buttons) in opacity-transition div; hidden at rest (REQ-007)
- [x] T24: Replace move button inline classes with Button ghost/sm variant (REQ-003, REQ-007)
- [x] T25: Fix GhostCard width from w-68 to w-72 (REQ-008)
- [x] T26: Import SPRING_GHOST_LIFT from lib/motion.ts for GhostCard animate transition (REQ-021)
- [x] T27: Import all spring constants in board.tsx from lib/motion.ts (REQ-020)
- [x] T28: Replace BoardColumn section element with div role=group + aria-labelledby (REQ-024)
- [x] T29: Add aria-label to column h2 element with unique id for labelledby binding (REQ-024)
- [x] T30: Add per-column empty state inside BoardColumn ul when column.cards.length === 0 (REQ-009)
- [x] T31: Update board-level EmptyState to only render when totalCards === 0 (REQ-009)
- [x] T32: Add AlertTriangle icon + aria-label to WIP warning in column header (REQ-010)
- [x] T33: Update drag handle aria-label to include keyboard instruction text (REQ-024 / a11y)
- [x] T34: Fix MoveToast exit y offset from y:8 to y:12 in move-toast.tsx (REQ-022)

## Phase 5 — Backlog Refactor

- [x] T35: Extract filter controls into src/components/backlog/backlog-toolbar.tsx (REQ-016)
- [x] T36: Extract single row renderer into src/components/backlog/backlog-row.tsx (REQ-016)
- [x] T37: Extract inline edit form into src/components/backlog/backlog-edit-form.tsx; use Input primitive (REQ-016, REQ-004)
- [x] T38: Extract pagination controls into src/components/backlog/backlog-paginator.tsx (REQ-016)
- [x] T39: Replace confirm() delete with two-step inline confirmation in backlog-row.tsx (REQ-017)
- [x] T40: Add dynamic aria-label to sort direction toggle in backlog-toolbar.tsx (REQ-018)
- [x] T41: Replace searchClassName raw class string with Input primitive in backlog-toolbar.tsx (REQ-004)
- [x] T42: Add flex-wrap to filter toolbar container for small screen overflow (responsive)
- [x] T43: Replace raw button classes in backlog.tsx and sub-components with Button primitive (REQ-003)

## Phase 6 — Issue Detail

- [x] T44: Remove local formatState from issue-detail.tsx; import from card-meta.tsx (REQ-005, T04/T05)
- [x] T45: Replace raw label li elements with Badge variant="outline" in issue-detail.tsx (REQ-006)
- [x] T46: Render linked PR numbers as anchor links using GitHub URL pattern (REQ-019)
- [x] T47: Verify back-navigation affordance exists in the backlog split-pane layout

## Phase 7 — Motion & Feedback

- [x] T48: Add opacity to rail collapse animation: opacity:0 when collapsed, opacity:1 when expanded (REQ-025)
- [x] T49: Gate rail opacity on reduceMotion flag in board-workspace.tsx (REQ-025)
- [x] T50: Import SPRING_RAIL from lib/motion.ts in board-workspace.tsx (REQ-020)
- [x] T51: Import EASE_TOAST from lib/motion.ts in move-toast.tsx (REQ-020)

## Phase 8 — Accessibility Pass

- [x] T52: Audit all aria-label values across board.tsx, backlog.tsx, app-header.tsx
- [x] T53: Verify WCAG AA contrast for text-muted-foreground on bg-card in dark theme
- [x] T54: Verify WCAG AA contrast for text-muted-foreground on bg-card in light theme
- [x] T55: Confirm no focus ring clips on rounded-full elements (badge, count pill, nav items)

## Phase 9 — Consistency Polish

- [x] T56: Audit all border-radius values: confirm rounded-xl (columns), rounded-lg (cards/inputs/buttons), rounded-full (badges/pills) hierarchy is intentional
- [x] T57: Audit all icon sizes: confirm h-4 w-4 (standard), h-3.5 w-3.5 (in buttons), h-3 w-3 (inline meta) usage is consistent
- [x] T58: Run full dark theme visual review (dev mode)
- [x] T59: Run full light theme visual review (dev mode)

## Phase 10 — Test & Verification

- [x] T60: Run vitest — all existing tests must pass
- [x] T61: Run tsc --noEmit — zero TypeScript errors
- [x] T62: Verify board-workspace renders without global scroll in viewport
- [x] T63: Verify card hover reveals drag handle and move buttons
- [x] T64: Verify ghost card matches column width (w-72)
- [x] T65: Verify sync button uses secondary variant
- [x] T66: Verify IssueDetail uses Badge for labels and shared formatState
