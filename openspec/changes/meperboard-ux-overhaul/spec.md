# Specs: meperboard-ux-overhaul

## REQ-001 — Layout: Viewport-constrained board shell

**Priority:** P0
**Files:** src/components/workspace/board-workspace.tsx

The board workspace MUST occupy exactly the full viewport height without triggering global
page scroll. The AppHeader and sync toolbar are sticky at the top; the board area below
them scrolls horizontally (columns) while each column scrolls vertically (cards).

Constraints:
- Root element of BoardWorkspace: `h-screen flex flex-col overflow-hidden`
- Board content area (below toolbar): `flex-1 min-h-0 overflow-hidden`
- Column list wrapper: `h-full overflow-x-auto`
- No min-h-screen anywhere in the component tree

## REQ-002 — Layout: Per-column vertical scroll

**Priority:** P0
**Files:** src/components/board/board.tsx

Each BoardColumn body (the `<ul>` of cards) MUST scroll vertically when its card count
exceeds the available column height.

Constraints:
- Column outer element: `flex flex-col` with a max-height that accounts for header height
- Column `<ul>`: `flex-1 min-h-0 overflow-y-auto flex flex-col gap-2`
- Scrollbar should use OS default (no custom scrollbar CSS in this phase)
- `Show N more` expand-in-place CAN be removed from board.tsx if per-column scroll is
  implemented; the capping logic in lib/capping.ts stays for backlog

## REQ-003 — Design System: Button primitive

**Priority:** P1
**Files:** src/components/ui/button.tsx (NEW)

A Button primitive MUST exist with the following variants: primary, secondary, ghost,
destructive. It must accept all native button attributes plus an optional `loading` boolean
that replaces children with a spinner and disables the button.

```
Variants:
  primary   — bg-primary text-primary-foreground hover:bg-primary-hover
  secondary — border bg-card hover:bg-muted hover:border-foreground/20
  ghost     — hover:bg-accent hover:text-foreground (no border)
  destructive — bg-destructive text-primary-foreground hover:opacity-90

Sizes:
  sm — px-2.5 py-1.5 text-xs
  md — px-3 py-1.5 text-sm (default)
  lg — px-4 py-2 text-sm
```

All existing button Tailwind strings in the following files MUST be replaced with `<Button>`:
- board-workspace.tsx (Sync button, RailToggle)
- board.tsx (column expand, move left/right)
- backlog.tsx (all buttons)
- local-cards.tsx (all buttons)

## REQ-004 — Design System: Input primitive

**Priority:** P1
**Files:** src/components/ui/input.tsx (NEW)

An Input primitive MUST unify `searchClassName` and `editorInputClassName` from backlog.tsx.
Standard props: all HTMLInputElement attributes. Class: canonical rounded-lg border
bg-card py-1.5 px-3 text-sm text-foreground with hover and focus-visible states.

## REQ-005 — Design System: Remove formatState duplication

**Priority:** P1
**Files:** src/components/ui/card-meta.tsx, src/components/issue-detail/issue-detail.tsx

`formatState` defined in card-meta.tsx MUST be exported and imported in issue-detail.tsx.
The local definition in issue-detail.tsx MUST be removed.

## REQ-006 — Design System: IssueDetail uses Badge for labels

**Priority:** P1
**Files:** src/components/issue-detail/issue-detail.tsx

Labels in IssueDetailView MUST render using `<Badge variant="outline">` from the shared
Badge primitive. The inline `rounded-full border px-2.5 py-0.5 text-xs` class string on
the `<li>` elements MUST be removed.

## REQ-007 — Board: Card hover-reveal actions

**Priority:** P1
**Files:** src/components/board/board.tsx

The GripVertical drag handle and the MoveLeft/MoveRight buttons MUST be hidden at rest and
visible on card hover or focus-within.

Implementation:
- Add `group` class to the card `<motion.li>`.
- Drag handle: `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150`
- Move button row: same opacity pattern OR slide-up from bottom of card on hover.
- The border-t separator above the move buttons MUST also only show on hover.
- Keyboard users: the buttons must still be reachable via Tab (opacity-0 elements with
  visible focus ring are acceptable; alternatively use sr-only + focus-visible:not-sr-only).

## REQ-008 — Board: Ghost card width fix

**Priority:** P2
**Files:** src/components/board/board.tsx

GhostCard MUST use `w-72` instead of `w-68` to match the column width.

## REQ-009 — Board: Per-column empty state

**Priority:** P2
**Files:** src/components/board/board.tsx

When a column has zero cards (`column.cards.length === 0`), MUST show a minimal
inline empty indicator inside the column (e.g., a dashed placeholder area with no icon,
just muted text "No cards"). The board-level EmptyState MUST only show when ALL columns
are empty AND totalCards === 0.

## REQ-010 — Board: WIP warning accessible

**Priority:** P1
**Files:** src/components/board/board.tsx

WIP limit exceeded MUST be communicated via an inline `AlertTriangle` icon next to the
count pill, with `aria-label="Column over WIP limit"`. The `title` attribute on the count
pill can remain as supplementary info but MUST NOT be the only signal.

## REQ-011 — App Header: Active nav indicator

**Priority:** P2
**Files:** src/components/app-header/app-header.tsx

Active nav item MUST be visually distinct from hovered inactive items.
Solution: active item gets `text-foreground font-medium` plus a 2px bottom border in
`border-primary` color. Remove `bg-accent` from active state (too similar to hover).

## REQ-012 — App Header: ThemeToggle icon transition

**Priority:** P3
**Files:** src/components/app-header/theme-toggle.tsx

The Sun/Moon icon swap MUST animate. Use CSS `transition-all duration-200` on the button
plus a `rotate-90 scale-0` → `rotate-0 scale-100` pattern by wrapping each icon in a
`<span>` with conditional transform classes.

## REQ-013 — Sync Toolbar: Button downgrade

**Priority:** P2
**Files:** src/components/workspace/board-workspace.tsx

The Sync button MUST use the `secondary` Button variant. It MUST NOT use `bg-primary` in a
toolbar context. The primary variant is reserved for creation/CTA actions.

## REQ-014 — Sync Toolbar: Status icon feedback

**Priority:** P2
**Files:** src/components/workspace/board-workspace.tsx

Sync status text MUST include an icon:
- Not synced: `<Clock>` icon + muted text "Not synced"
- Success: `<CheckCircle>` icon + success-colored text "Imported N items"
- Error: `<AlertCircle>` icon + destructive-colored text "Sync failed"
Icons: h-3.5 w-3.5, inline with the text.

## REQ-015 — Sync Toolbar: RailToggle visible label

**Priority:** P2
**Files:** src/components/workspace/board-workspace.tsx

RailToggle MUST show a visible text label in addition to the PanelRight icon.
Label: "Local" when collapsed, "Local (N)" where N is the local card count when expanded.
This eliminates the icon-only affordance.

## REQ-016 — Backlog: Split into sub-components

**Priority:** P2
**Files:** src/components/backlog/backlog.tsx + 4 NEW files

backlog.tsx MUST be split so that no single file exceeds 300 lines:
- BacklogToolbar — filter controls, search, sort, group, type filter
- BacklogRow — single row renderer (used by virtual list)
- BacklogEditForm — inline edit form for local cards
- BacklogPaginator — pagination controls
- backlog.tsx retains the virtual list orchestration and state

## REQ-017 — Backlog: Inline delete confirmation

**Priority:** P1
**Files:** src/components/backlog/backlog-row.tsx (NEW)

Delete action MUST NOT use browser `confirm()`. Replace with two-step inline pattern:
- First click: changes button label to "Confirm?" with destructive styling, sets a
  pending-delete state for that row ID.
- Second click on same row: executes delete.
- Clicking anywhere else or tabbing away: resets pending-delete state.

## REQ-018 — Backlog: Sort direction aria-label

**Priority:** P1
**Files:** src/components/backlog/backlog-toolbar.tsx (NEW)

Sort direction toggle MUST have an `aria-label` that announces the CURRENT direction and
what clicking will do: e.g., `aria-label="Sort ascending (click to sort descending)"`.

## REQ-019 — Issue Detail: Linked PR links

**Priority:** P2
**Files:** src/components/issue-detail/issue-detail.tsx

Linked PR numbers MUST be rendered as anchor elements pointing to the GitHub URL of the PR
in the same repository. URL pattern: `{item.html_url.replace(/\/issues\/\d+$/, '')}/pull/{pr}`.
Open in new tab with `target="_blank" rel="noreferrer"`.

## REQ-020 — Motion: Centralized constants

**Priority:** P3
**Files:** src/lib/motion.ts (NEW)

All spring/easing constants used across board.tsx, board-workspace.tsx, and backlog.tsx
MUST be extracted into src/lib/motion.ts and imported from there.

```
SPRING_CARD_FLIGHT — stiffness 500, damping 40, mass 0.9 (layout animations)
SPRING_GHOST_LIFT  — stiffness 700, damping 35, mass 0.7 (drag overlay pickup)
SPRING_RAIL        — stiffness 400, damping 34, mass 0.9 (rail collapse)
EASE_TOAST         — duration 0.18, ease "easeOut"
```

## REQ-021 — Motion: Ghost lift spring

**Priority:** P3
**Files:** src/components/board/board.tsx

GhostCard MUST use SPRING_GHOST_LIFT (stiffness 700) for its scale+rotate animation,
separate from SPRING_CARD_FLIGHT used for layout animations.

## REQ-022 — Motion: MoveToast symmetric animation

**Priority:** P3
**Files:** src/components/board/move-toast.tsx

MoveToast MUST use symmetric y offsets for enter and exit: both `y: 12`.
Current exit uses `y: 8` — fix to `y: 12`.

## REQ-023 — Accessibility: Focus ring integrity

**Priority:** P1
**Files:** src/app/globals.css

`outline-offset` for elements with `rounded-full` MUST be at least 3px to prevent the
outline from being clipped by the border-radius. Add:
```css
.rounded-full:focus-visible {
  outline-offset: 3px;
}
```

## REQ-024 — Accessibility: Column landmark reduction

**Priority:** P2
**Files:** src/components/board/board.tsx

BoardColumn MUST use `role="group"` + `aria-labelledby` pointing to the column title `<h2>`
instead of the `<section>` element, to reduce the number of landmark regions announced
by screen readers when many columns are present.

## REQ-025 — Motion: Rail opacity fade

**Priority:** P3
**Files:** src/components/workspace/board-workspace.tsx

The collapsed Local Cards rail MUST fade its content opacity (0 when collapsed, 1 when
expanded) in addition to the width animation. Use `AnimatePresence` or an `opacity`
property added to the existing `motion.aside` animate object. Gate on prefers-reduced-motion.
