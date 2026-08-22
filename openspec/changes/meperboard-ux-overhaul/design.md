# Design: meperboard-ux-overhaul

## Design Philosophy

MeperBoard's identity: a fast, local-first GitHub issue management tool for developers.
The visual language should communicate precision, speed, and control — not generic SaaS.

Reference products (for inspiration, not copying): Linear, Vercel dashboard, Raycast.
MeperBoard already has the Linear color token foundation. This design doc builds on it.

Priority order: UX clarity > consistency > performance > aesthetics > effects.

---

## 1. Typography Scale (no changes — existing is correct)

Inter (variable) is the right choice. Existing scale in use:
- Headings: text-2xl font-semibold tracking-tight (issue detail h2)
- Section labels: text-xs font-semibold uppercase tracking-wider text-muted-foreground
- Body: text-sm leading-6
- Card title: text-sm font-medium leading-snug
- Meta/labels: text-xs tabular-nums text-muted-foreground

No changes needed to the type scale. Consistency pass will enforce these classes.

---

## 2. Spacing & Sizing

### Column layout
- Column width: w-72 (288px) — keep as-is
- Column gap: gap-3 — keep as-is
- Column padding: p-2 — keep as-is
- Column header: px-2 py-1.5 — keep as-is
- Card gap within column ul: gap-2 — keep as-is

### Card anatomy
- Card padding: p-3 — keep as-is
- Card title mt: none (title is first child)
- Meta row mt: mt-2 — keep as-is
- Labels row mt: mt-1.5 — keep as-is
- Hover action row: mt-2 pt-2 border-t — HIDDEN AT REST, shown on hover

### Toolbar
- Height: py-3 (12px top + 12px bottom) — keep as-is
- Gap between items: gap-3 — keep as-is

### AppHeader
- Height: h-14 (56px) — keep as-is
- Nav item padding: px-2.5 py-1.5 — keep as-is

---

## 3. Color Usage

Design token reference (from globals.css — do not use raw color values in components):

| Token | Usage |
|-------|-------|
| --background | Page canvas |
| --card | Column surfaces, card surfaces, input backgrounds |
| --elevated | Card surface (slight elevation above column) |
| --popover | Dropdown / toast surfaces |
| --foreground | Primary text |
| --muted-foreground | Secondary/meta text |
| --primary | CTA buttons, accent rings, focus |
| --primary-hover | CTA button hover |
| --link | Anchor text |
| --border | Borders, dividers |
| --muted | Muted backgrounds (hover targets, badges) |
| --success | Open state badges |
| --warning | WIP limit indicators |
| --destructive | Delete actions, error states |
| --ring | Focus outlines |

### New Color Rules for this overhaul

1. Primary button (g-primary) → reserved for creation and single primary CTA per view.
   Sync is a utility action → use secondary button.
2. Destructive actions → always use 	ext-destructive or g-destructive — never raw red.
3. Status icons in toolbar → 	ext-success, 	ext-destructive, 	ext-muted-foreground.

---

## 4. Component Visual Specifications

### Button Primitive

Three visual weights:

**Primary** (creation / primary CTA):
- Background: bg-primary
- Text: text-primary-foreground
- Hover: bg-primary-hover
- Disabled: opacity-50 cursor-not-allowed
- Height: h-8 (default)
- Padding: px-3 py-1.5 (md), px-2.5 py-1 (sm), px-4 py-2 (lg)
- Border radius: rounded-lg
- Font: text-sm font-medium

**Secondary** (utility, support actions):
- Background: bg-card
- Border: border
- Text: text-foreground
- Hover: bg-muted border-foreground/20
- Same sizing as primary

**Ghost** (icon buttons, nav items, tertiary):
- Background: transparent
- Text: text-muted-foreground
- Hover: bg-accent text-foreground
- No border
- Typical use: ThemeToggle, drag handle, icon-only buttons

**Destructive** (delete, irreversible):
- Background: transparent (ghost style at rest)
- Text: text-destructive
- Hover: bg-destructive/10
- After first click (confirm state): bg-destructive text-primary-foreground

### Input Primitive

Single visual style:
- Background: bg-card
- Border: border
- Border radius: rounded-lg
- Padding: py-1.5 px-3
- Font: text-sm text-foreground
- Placeholder: text-muted-foreground/70
- Hover: border-foreground/20
- Focus: ring-1 ring-ring (via focus-visible CSS)
- Height: implied by padding (~36px)

Search variant adds a pl-8 left padding to accommodate the Search icon.

### Tooltip Primitive

CSS-only approach (no JS required for simple cases):
- Trigger: any element with data-tooltip="text" attribute
- OR a wrapper component with aria-label + title fallback
- Visual: absolute-positioned div, bg-popover border rounded-md px-2 py-1 text-xs shadow-lg
- Show on hover + focus
- Prefer JS-free for static tooltips; use a lightweight hook for dynamic content

For this phase, implement as a React component wrapping children:
`
<Tooltip content="Label">
  <button>...</button>
</Tooltip>
`
Uses CSS position:absolute within a relative wrapper. No portal needed for simple cases.

### Card (BoardCard) Design

`
State machine:
  rest     → title visible, meta row visible, labels visible
              drag handle: opacity-0
              move buttons row: opacity-0 (border-t hidden too)
  hover    → drag handle: opacity-100 (transition 150ms)
              move buttons row: opacity-100 (border-t visible)
  dragging → card origin: opacity-40 (current behavior — keep)
  ghost    → lifted card at cursor: scale 1.03, rotate 1.5deg, elevation-3 shadow + ring
`

The move button row layout:
- lex items-center gap-1 border-t pt-2
- Wrapped in opacity-transition div
- Both MoveLeft and MoveRight buttons use ghost variant

The drag handle:
- Position: top-left of card header area (current position — keep)
- Size: h-4 w-4
- Color at rest: text-muted-foreground
- Color on hover: text-foreground

### BoardColumn Design

`
Header:
  title: text-sm font-medium tracking-tight
  count pill: rounded-full px-2 py-0.5 text-xs tabular-nums
    normal: bg-muted text-muted-foreground
    over WIP: bg-warning/10 text-warning border border-warning/30
              + inline AlertTriangle icon h-3 w-3 (NEW, accessible)

Droppable state (isOver):
  border-primary/60 bg-primary/5 ring-1 ring-primary/30 (current — keep)

Landing pulse animation:
  mount-only opacity 0.85→0 fade (current — keep)

Column body (ul):
  flex flex-col gap-2
  overflow-y-auto
  max-height: calc(100vh - 56px [header] - 57px [toolbar] - 2.5rem [col header+padding])
  Note: use CSS custom property --board-columns-max-height set on the board root
  to avoid magic numbers scattered across components.
`

### App Header Active Nav Indicator

Before (too subtle):
`
active: bg-accent text-foreground
hover:  bg-accent/60 hover:text-foreground
`

After (Linear-style):
`
active: text-foreground font-medium relative
        after: absolute bottom-[-1px] left-0 right-0 h-[2px] bg-primary rounded-full
inactive hover: text-muted-foreground → text-foreground bg-accent/60
`
The 2px accent line under the active item makes it unambiguous vs. hover.

### Sync Toolbar Layout (revised)

`
[Sync button (secondary)] [status icon + text (muted)] [--flex gap--] [stat pills] [rail toggle]
`

Status text with icons:
- Idle: <Clock h-3.5> "Not synced" (muted)
- Success: <CheckCircle h-3.5 text-success> "Imported N items" (text-success)
- Error: <AlertCircle h-3.5 text-destructive> "Sync failed" (text-destructive)

RailToggle label:
- Collapsed: <PanelRight> "Local" (no count — panel is hidden)
- Expanded: <PanelRight> "Local (N)"

### ThemeToggle Animation

Replace static icon swap with animated transition:
- Button wraps two absolutely-positioned icon spans
- Dark mode → Sun visible, Moon hidden (scale-0 opacity-0)
- Light mode → Moon visible, Sun hidden (scale-0 opacity-0)
- Transition: 	ransition-all duration-200 ease-in-out on each span

---

## 5. Motion Design

### Spring Registry (src/lib/motion.ts)

`	ypescript
// Layout animations — card flights between columns
SPRING_CARD_FLIGHT = { type: "spring", stiffness: 500, damping: 40, mass: 0.9 }

// Drag overlay pickup — snappier than flight
SPRING_GHOST_LIFT = { type: "spring", stiffness: 700, damping: 35, mass: 0.7 }

// Rail collapse / expand
SPRING_RAIL = { type: "spring", stiffness: 400, damping: 34, mass: 0.9 }

// Toast enter/exit
EASE_TOAST = { duration: 0.18, ease: "easeOut" }

// Hover micro-interactions — use CSS transitions, not framer-motion
// duration-150 ease-out for opacity, color, border changes
`

### Hover Microinteractions

All hover state changes use CSS transitions (Tailwind 	ransition-* classes), not
framer-motion. This keeps the JS bundle untouched and leverages GPU-composited properties.

- Opacity changes: 	ransition-opacity duration-150
- Color changes: 	ransition-colors duration-150
- Transform (ThemeToggle, border indicator): 	ransition-all duration-200

### Card Action Reveal

Drag handle and move button row reveal:
- Property: opacity (GPU-composited — no layout cost)
- Duration: 150ms ease-out
- Do NOT animate height/display — use opacity+pointer-events for hide/show

`
hidden state: opacity-0 pointer-events-none
hover state:  opacity-100 pointer-events-auto
`

### Rail Collapse (enhanced)

Current: width spring only.
Add: content opacity (0 when fully collapsed, 1 when expanded).

`	ypescript
animate={{
  width: collapsed ? 0 : RAIL_WIDTH,
  opacity: collapsed ? 0 : 1,
}}
`

Gate this on !reduceMotion (already done for width).

### MoveToast (fix)

Symmetric: initial: { opacity: 0, y: 12 }, exit: { opacity: 0, y: 12 }.

### Landing Column Pulse

Current behavior is correct — keep as-is.

---

## 6. Accessibility Design

### Focus Ring

Global rule: outline: 2px solid var(--ring); outline-offset: 2px
Override for rounded-full elements: outline-offset: 3px

This prevents the outline from being visually clipped by the border radius on badge-shaped
elements.

### Column Landmark Reduction

Replace <section> with <div role="group" aria-labelledby="col-{id}-title">.
The <h2> gets id="col-{id}-title".

This reduces the landmark count from N regions to 1 region (the board ole="region").
Screen readers will still announce column names when navigating cards.

### Drag Handle Instruction Text

Update ria-label on drag handle button:
- Before: "Drag {card.title}"
- After: "Drag {card.title} (or use Move left/right buttons below)"

### WIP Warning

Add <AlertTriangle aria-label="Column over WIP limit" className="h-3 w-3 text-warning" />
inline next to the count pill. The 	itle attribute on the pill can stay as supplementary.

### Backlog Sort Direction

`
aria-label={Sort  . Click to reverse.}
`

### Delete Confirmation

The two-step inline pattern avoids a focus trap (no modal) and stays keyboard accessible:
- State 1: Delete button with ria-label="Delete {title}"
- State 2: "Confirm?" button with ria-label="Confirm delete {title}" + destructive style
- State resets on blur (onBlur) or Escape key

---

## 7. Responsive Strategy

### Board (Board view)
- Mobile (<640px): horizontal scroll of column list (current — keep)
- Tablet (640–1024px): same as mobile
- Desktop (≥1024px): Local Cards rail visible by default

No responsive layout changes needed for the board itself beyond the h-screen constraint.

### Backlog (Backlog view)
- Filter toolbar wraps on small screens: lex flex-wrap gap-2
- Pagination centers on all sizes (current) — acceptable
- Virtual list fills available width (current — keep)

### AppHeader
- No responsive changes needed (current behavior is acceptable)

### Sync Toolbar
- On <640px: stat pills move below the sync button + status on a second line
  Implementation: lex flex-wrap on the toolbar container

---

## 8. State Design

### Board States

| State | Visual |
|-------|--------|
| Loading | BoardSkeleton (3 col shimmer) — keep as-is |
| Error | AlertCircle + "Failed to load" centered in dashed border box |
| Empty (all columns) | Inbox icon + "No cards yet" + helper text — keep |
| Empty (per column) | Dashed placeholder "No cards" (text only, no icon) |
| Dragging | Origin card: opacity-40; Ghost: lifted 1.03x + tilt + elevation-3 |
| Over column | Column: border-primary/60 bg-primary/5 ring-1 ring-primary/30 |
| Card just landed | Column: accent ring pulse 300ms fade |

### Sync States

| State | Button | Status Text |
|-------|--------|-------------|
| Idle | secondary "Sync" | Clock icon + "Not synced" |
| Pending | disabled + animate-spin icon + "Syncing…" | — |
| Success | secondary "Sync" | CheckCircle (success) + "Imported N items" |
| Error | secondary "Sync" | AlertCircle (destructive) + "Sync failed" |

Success state auto-resets to idle after 8 seconds (implement via useEffect timeout in
board-workspace.tsx — sync.isSuccess is already the flag).

### Rail States

| State | Width | Opacity | Toggle label |
|-------|-------|---------|--------------|
| Expanded | 340px | 1 | "Local (N)" |
| Collapsed | 0px | 0 | "Local" |

---

## 9. File Organization (no architectural changes)

`
src/
  components/
    ui/
      badge.tsx         (existing)
      button.tsx        (NEW)
      input.tsx         (NEW)
      tooltip.tsx       (NEW)
      card-meta.tsx     (existing, export formatState)
      select.tsx        (existing, unchanged)
    app-header/
      app-header.tsx    (updated)
      theme-toggle.tsx  (updated)
    board/
      board.tsx         (updated)
      move-toast.tsx    (updated)
      move.ts           (unchanged)
    workspace/
      board-workspace.tsx (updated)
    backlog/
      backlog.tsx         (updated — orchestration only)
      backlog-toolbar.tsx (NEW)
      backlog-row.tsx     (NEW)
      backlog-edit-form.tsx (NEW)
      backlog-paginator.tsx (NEW)
    issue-detail/
      issue-detail.tsx  (updated)
    local-cards/
      local-cards.tsx   (minor button updates)
  lib/
    motion.ts           (NEW)
    ... (all others unchanged)
`

No new npm dependencies. All additions use already-installed packages.
