"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CircleDot, GitPullRequest, PanelRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { countByType } from "../../lib/card-filters";
import {
  loadLocalCardsCollapsed,
  saveLocalCardsCollapsed,
} from "../../lib/local-cards-collapsed";
import { useMinWidth } from "../../lib/use-min-width";
import { useBacklog, useLocalCards, useMoveCard, useSync } from "../../state";
import { AppHeader } from "../app-header/app-header";
import { Badge } from "../ui/badge";
import { Board } from "../board";
import { LocalCards } from "../local-cards";

/** Desktop width of the Local Cards rail (matches the round-1 grid column). */
const RAIL_WIDTH = 340;
/** Collapse spring — settles in ~250ms: quick shut, no wobble at rest. */
const RAIL_SPRING = { type: "spring", stiffness: 400, damping: 34, mass: 0.9 } as const;

/**
 * The board page composition: app header, a read-only sync control, the kanban
 * board (with move persistence wired), and the local-card rail. This is where
 * the board's `onMoveCard` report becomes a store write — local cards update
 * their column in place; GitHub items write a `column_overrides` row.
 *
 * UX round 3 adds: the sync-bar total split into per-kind stat pills, and a
 * collapsible Local Cards rail. The collapse toggle lives in this toolbar (not
 * inside the panel) so it stays reachable while the panel is fully collapsed
 * and the board takes the whole width.
 */
export function BoardWorkspace() {
  const sync = useSync();
  const [collapsed, setCollapsed] = useState(false);

  // Restore after mount (never during SSR render) — same pattern as the
  // persisted backlog sort.
  useEffect(() => {
    setCollapsed(loadLocalCardsCollapsed());
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      saveLocalCardsCollapsed(next);
      return next;
    });
  }

  return (
    <div className="min-h-screen">
      <AppHeader />

      <div className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")}
            aria-hidden="true"
          />
          {sync.isPending ? "Syncing…" : "Sync"}
        </button>
        <span className="text-xs text-muted-foreground" data-testid="sync-status">
          {sync.isError
            ? "Sync failed"
            : sync.isSuccess
              ? `Imported ${sync.data.imported} item${sync.data.imported === 1 ? "" : "s"}`
              : "Not synced yet"}
        </span>
        <TotalCount />
        <RailToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      <RailLayout collapsed={collapsed} />
    </div>
  );
}

/**
 * Rail collapse toggle (UX round 3): PanelRight icon + local-card count pill.
 * Sits in the sync bar so it remains reachable while the rail is collapsed;
 * `aria-expanded` + `aria-controls` bind it to the panel it reveals.
 */
function RailToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      data-testid="rail-toggle"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls="local-cards-panel"
      title={collapsed ? "Show local cards" : "Hide local cards"}
      className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 shadow-xs transition-colors duration-150 hover:border-foreground/20 hover:bg-muted"
    >
      <PanelRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <LocalCountPill />
    </button>
  );
}

/** Count pill inside the rail toggle; reflects stored local cards. */
function LocalCountPill() {
  const { list } = useLocalCards();
  const count = list.data?.length ?? 0;
  return (
    <Badge variant="neutral" className="tabular-nums normal-case">
      {count}
    </Badge>
  );
}

/**
 * Board + Local Cards rail. On desktop (lg+) the rail collapses via a
 * framer-motion width spring (~250ms); below lg it stacks full-width and the
 * toggle simply hides it. A collapsed panel is pulled out of the accessibility
 * tree (`aria-hidden` + `inert`) while the shrink animation plays, so hidden
 * form fields never join the tab order.
 */
function RailLayout({ collapsed }: { collapsed: boolean }) {
  const isDesktop = useMinWidth(1024);
  const reduceMotion = useReducedMotion() ?? false;
  const moveCard = useMoveCard();

  return (
    <div
      className={cn(
        "flex flex-col",
        // The desktop gutter disappears with the rail so the board truly
        // takes the full width when collapsed.
        !collapsed && "gap-4 lg:flex-row lg:items-start lg:gap-4",
        collapsed && "flex-col lg:flex-row lg:items-start",
      )}
    >
      <div className="min-w-0 flex-1">
        <Board onMoveCard={(move) => moveCard.mutate(move)} />
      </div>
      <motion.aside
        id="local-cards-panel"
        initial={false}
        animate={
          isDesktop
            ? { width: collapsed ? 0 : RAIL_WIDTH }
            : { width: collapsed ? 0 : "auto" }
        }
        transition={reduceMotion ? { duration: 0 } : RAIL_SPRING}
        aria-hidden={collapsed || undefined}
        inert={collapsed || undefined}
        className="shrink-0 overflow-hidden"
      >
        <div className="w-full min-w-0 lg:w-[340px]">
          <LocalCards />
        </div>
      </motion.aside>
    </div>
  );
}

/**
 * Sync-bar stat pills (UX round 3): one pill per kind across currently synced
 * cards — issues with a CircleDot icon, PRs with GitPullRequest — plus a local
 * pill only when local cards exist. The group keeps the stable `total-count`
 * testid.
 */
function TotalCount() {
  const { data } = useBacklog();
  const counts = useMemo(() => countByType(data ?? []), [data]);

  return (
    <div className="ml-auto flex items-center gap-2" data-testid="total-count">
      <Badge variant="neutral" className="tabular-nums">
        <CircleDot className="h-3 w-3" aria-hidden="true" />
        {counts.issue} issues
      </Badge>
      <Badge variant="neutral" className="tabular-nums">
        <GitPullRequest className="h-3 w-3" aria-hidden="true" />
        {counts.pull} PRs
      </Badge>
      {counts.local > 0 && (
        <Badge variant="primary" className="tabular-nums">
          {counts.local} local
        </Badge>
      )}
    </div>
  );
}
