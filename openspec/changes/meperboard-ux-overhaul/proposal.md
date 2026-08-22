# Proposal: meperboard-ux-overhaul

## Summary

Complete UX/UI overhaul of MeperBoard to elevate it from a functional MVP to a polished,
professional developer-productivity application. The work spans layout architecture, design
system hardening, board and card UX, microinteractions, accessibility, responsiveness, and
all application UI states. No functionality is removed; the upgrade improves how everything
looks, feels, and behaves.

## Problem Statement

MeperBoard has solid foundations (dnd-kit, framer-motion, Dexie, TanStack Query, Tailwind
v4, a Linear-inspired token system) and several UX rounds already applied. However, a
thorough inspection reveals it still falls short of the professional developer tool bar in
several areas:

### Layout & Scroll Architecture
- BoardWorkspace wraps everything in min-h-screen with no height constraint, so the
  board area overflows the viewport and triggers global page scroll instead of per-column
  scroll. Columns should fill the available viewport height and scroll internally.
- The sync toolbar and AppHeader stack correctly but the board below them bleeds past the
  fold — there is no calc(100vh - header - toolbar) container anywhere.

### Design System Gaps
- The Badge component has 5 variants but IssueDetailView rolls its own inline
  rounded-full border px-2.5 classes for labels, duplicating badge appearance outside the
  system.
- IssueDetailView also duplicates the formatState function that already exists in card-meta.tsx.
- Select UI primitive exists but the backlog hardcodes several raw select shapes via
  searchClassName / editorInputClassName — no single canonical input class.
- No Button primitive: every interactive element composes raw Tailwind utility strings,
  making consistency drift inevitable.
- No Tooltip primitive: title attributes are the only affordance for truncated text.
- Shadow tokens (--elevation-1/2/3) are defined but shadow-xs/sm/lg mappings are
  inconsistent causing usage drift.

### Board / Card UX
- Card drag handle (GripVertical) is always visible, adding visual noise on every card.
  It should appear only on hover / focus.
- MoveLeft/MoveRight keyboard controls sit inside a border-t footer row on every card,
  permanently occupying ~28px per card and revealing the mechanism visually.
  These should appear on hover only.
- Ghost card width is hardcoded w-68 (non-standard); should match column width w-72.
- Board columns have no max-height + overflow-y-auto — long columns force horizontal
  scroll of the entire board container rather than scrolling within the column.
- Empty state is placed above the column list and disappears once ANY column has a card.
- WIP warning uses a title tooltip on the count pill (inaccessible on touch).

### App Header
- Navigation active state (bg-accent text-foreground) is too subtle — ambiguous vs. hover.
- ThemeToggle icon swap has no transition — the Sun/Moon swap is abrupt.

### Sync Toolbar
- Sync button is a full primary bg-primary button — too heavy for a utility action in a toolbar.
- Sync status text lacks icon feedback — success and error states are visually identical.
- RailToggle has no visible label — just an icon + count.

### Backlog Page
- Filter toolbar overflows on small screens — no horizontal scroll or stacking strategy.
- Sort direction toggle has no aria-label that changes with direction.
- Edit inline form duplicates input classes instead of using a shared primitive.
- Delete confirmation is a browser confirm() dialog — should be inline confirmation.
- Group headers use a raw div with no semantic role.

### Issue Detail
- formatState duplicated (already in card-meta.tsx).
- Labels render as raw li with border instead of the shared Badge component.
- Linked PRs render as muted number pills but have no links to GitHub.
- No back navigation from the issue detail within the split-pane backlog layout.

### Accessibility
- GripVertical drag handle aria-label says "Drag {title}" with no keyboard instruction.
- WIP warning title attribute is not accessible on touch or to screen readers without hover.
- section + header pattern creates redundant region announcements for many columns.
- Some interactive elements override focus ring with rounded classes that clip outline.

### Motion
- DragOverlay ghost uses same spring as layout flights — should be snappier for pickup.
- MoveToast enter (y:12) vs exit (y:8) y-offsets are asymmetric.
- Rail collapse has no opacity fade on content as it collapses.

### Performance
- backlog.tsx is a single 875-line file — massive component hard to test and maintain.
- TotalCount uses useBacklog() as a second query consumer just for counts.

## Proposed Solution

Ten-phase approach adapted to the actual codebase:

### Phase 1 — Design System Hardening
- Add Button primitive (variants: primary, secondary, ghost, destructive).
- Add Tooltip primitive (CSS-based, no new dependency).
- Add Input primitive to unify searchClassName / editorInputClassName.
- Export formatState from card-meta.tsx (remove duplicate in issue-detail.tsx).
- Fix IssueDetailView label list to use shared Badge component.
- Alias shadow-md -> --elevation-2 in globals.css.

### Phase 2 — Layout & Scroll Architecture
- Constrain BoardWorkspace to full viewport height: h-screen flex flex-col.
- Give board area flex-1 overflow-hidden so it fills remaining height.
- Give BoardColumn max-h and overflow-y-auto so long columns scroll internally.
- Remove min-h-screen from BoardWorkspace outer div.

### Phase 3 — App Header & Sync Toolbar
- Strengthen active nav indicator (foreground/8 bg + accent bottom border).
- Downgrade Sync button to secondary variant.
- Add icon feedback to sync status: CheckCircle (success), AlertCircle (error), Clock (idle).
- Add visible RailToggle label: "Local (N)".
- Add ThemeToggle icon rotation transition.

### Phase 4 — Board & Card UX
- Hide drag handle and move buttons; reveal on group-hover.
- Per-column overflow-y-auto with max-height on column body ul.
- Fix ghost card width to w-72.
- Replace section + header with role=group + aria-labelledby for columns.
- Add per-column empty state inline when column.cards.length === 0.
- Replace WIP warning title with inline icon + tooltip.

### Phase 5 — Backlog Refactor
- Split backlog.tsx into: BacklogToolbar, BacklogRow, BacklogEditForm, BacklogPaginator.
- Replace confirm() delete with inline two-step confirmation.
- Fix sort direction aria-label to announce current direction.
- Add proper semantic roles to virtual list (rowgroup/row).

### Phase 6 — Issue Detail
- Remove duplicate formatState, import from card-meta.tsx.
- Replace raw label li with Badge component.
- Make linked PR numbers into anchor links.
- Add back-navigation affordance.

### Phase 7 — States & Feedback
- Make MoveToast enter/exit y-offsets symmetric (y:12 both).
- Add opacity fade to rail collapse via AnimatePresence.
- Add success checkmark flash after sync completes.

### Phase 8 — Motion System Cleanup
- Faster spring for ghost lift: stiffness 700, damping 35, mass 0.7.
- Centralize all spring/easing constants in src/lib/motion.ts.
- Gate rail opacity transition on prefers-reduced-motion.

### Phase 9 — Accessibility Pass
- Audit all aria-label values.
- Ensure no outline clips on rounded-full elements.
- Verify WCAG AA contrast for muted-foreground on card/elevated surfaces.

### Phase 10 — Consistency & Polish
- Audit border-radius hierarchy (xl columns, lg cards, full badges).
- Audit icon sizes.
- Final dark + light theme review.

## Affected Files

- src/app/globals.css — shadow-md alias
- src/components/ui/button.tsx — NEW
- src/components/ui/input.tsx — NEW
- src/components/ui/tooltip.tsx — NEW
- src/components/ui/card-meta.tsx — export formatState
- src/components/app-header/app-header.tsx — nav indicator, no other changes
- src/components/app-header/theme-toggle.tsx — icon transition
- src/components/board/board.tsx — column scroll, card hover actions, ghost width
- src/components/board/move-toast.tsx — symmetric exit animation
- src/components/workspace/board-workspace.tsx — h-screen layout, sync button, rail label
- src/components/backlog/backlog.tsx — split, delete confirm, a11y
- src/components/backlog/backlog-toolbar.tsx — NEW
- src/components/backlog/backlog-row.tsx — NEW
- src/components/backlog/backlog-edit-form.tsx — NEW
- src/components/backlog/backlog-paginator.tsx — NEW
- src/components/issue-detail/issue-detail.tsx — dedup, Badge, PR links
- src/lib/motion.ts — NEW

## Out of Scope

- Markdown rendering in issue body (requires new dependency).
- Route transition animations (Next.js ViewTransition — experimental).
- Virtualized columns (per-column scroll is the Phase 2 fix).
- New features (per-column filtering, global keyboard shortcuts).

## Non-Goals

- No functionality removal.
- No state management changes (TanStack Query + Dexie stays as-is).
- No routing changes.
- No new npm dependencies.

## Acceptance Criteria

1. Board columns scroll independently when cards overflow viewport height.
2. Card drag handle and move buttons are hidden at rest, visible on hover/focus.
3. A Button primitive exists and is used for all interactive buttons in the app.
4. Sync toolbar uses secondary button; status text has icon feedback.
5. IssueDetailView no longer duplicates formatState or Badge.
6. All animate-pulse skeletons remain; no spinners introduced.
7. All existing tests pass without modification.
8. prefers-reduced-motion is respected for all new animations.
9. No visual regressions in dark or light theme.
10. WIP warning is accessible without hover.
