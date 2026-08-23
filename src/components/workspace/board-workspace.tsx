"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  CircleDot,
  Clock,
  GitPullRequest,
  PanelRight,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { countByType } from "../../lib/card-filters";
import {
  loadLocalCardsCollapsed,
  saveLocalCardsCollapsed,
} from "../../lib/local-cards-collapsed";
import { SPRING_RAIL } from "../../lib/motion";
import { useMinWidth } from "../../lib/use-min-width";
import { useBacklog, useLocalCards, useMoveCard, useResetCardMove, useSync, type Card } from "../../state";
import { TOGGLE_LOCAL_CARDS_EVENT } from "../app-header/command-palette";
import { AppHeader } from "../app-header/app-header";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Portal } from "../ui/portal";
import { Board } from "../board";
import { LocalCards } from "../local-cards";

import { CardPreviewDrawer } from "../preview-drawer/card-preview-drawer";
import { SyncControl } from "./sync-control";

/** Desktop width of the Local Cards rail (matches the round-1 grid column). */
const RAIL_WIDTH = 340;

/**
 * The board page composition: app header, a read-only sync control, the kanban
 * board (with move persistence wired), and the local-card rail. This is where
 * the board's `onMoveCard` report becomes a store write — local cards update
 * their column in place; GitHub items write a `column_overrides` row.
 *
 * UX overhaul: constrained viewport height (no global scroll), secondary sync
 * button with icon state feedback, accessible rail toggle with Button primitive,
 * unified Badge chips for issue/PR counts, and instant CardPreviewDrawer.
 */
export function BoardWorkspace() {
  const [collapsed, setCollapsed] = useState<boolean>(() => loadLocalCardsCollapsed());
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const moveCard = useMoveCard();
  const resetCard = useResetCardMove();

  useEffect(() => {
    saveLocalCardsCollapsed(collapsed);
  }, [collapsed]);

  // The ⌘K palette's "Toggle local cards panel" command drives the same rail
  // state the toolbar toggle owns, so the palette stays a single entry point.
  useEffect(() => {
    function handleToggleLocalCards() {
      setCollapsed((prev) => !prev);
    }
    window.addEventListener(TOGGLE_LOCAL_CARDS_EVENT, handleToggleLocalCards);
    return () => window.removeEventListener(TOGGLE_LOCAL_CARDS_EVENT, handleToggleLocalCards);
  }, []);

  function toggle() {
    setCollapsed((prev) => !prev);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />

      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5 md:px-6">
        <SyncControl />
        <TotalCount />
        <RailToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <RailLayout collapsed={collapsed} onToggle={toggle} onSelectCard={setSelectedCard} />
      </div>

      <CardPreviewDrawer
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onMoveColumn={(cardId, toColumnId) => {
          moveCard.mutate({
            cardId,
            toColumnId,
          });
          if (selectedCard) {
            setSelectedCard({ ...selectedCard, columnId: toColumnId, isManualOverride: true });
          }
        }}
        onResetToGit={(cardId) => {
          resetCard.mutate(cardId);
          if (selectedCard && selectedCard.naturalColumnId) {
            setSelectedCard({
              ...selectedCard,
              columnId: selectedCard.naturalColumnId,
              isManualOverride: false,
            });
          }
        }}
      />
    </div>
  );
}

/**
 * Rail collapse toggle: PanelRight icon + text label + local-card count pill.
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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-testid="rail-toggle"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-controls="local-cards-panel"
      title={collapsed ? "Show local cards" : "Hide local cards"}
      className="shadow-xs"
    >
      <PanelRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs text-muted-foreground">Local</span>
      <LocalCountPill />
    </Button>
  );
}

/** Count pill inside the rail toggle; reflects stored local cards. */
function LocalCountPill() {
  const { list } = useLocalCards();
  const count = list.data?.length ?? 0;
  return (
    <Badge variant="accent" className="tabular-nums font-mono normal-case">
      {count}
    </Badge>
  );
}

function RailLayout({
  collapsed,
  onToggle,
  onSelectCard,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onSelectCard: (card: Card) => void;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const moveCard = useMoveCard();

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <Board
          onMoveCard={(move) => moveCard.mutate(move)}
          onSelectCard={onSelectCard}
        />
      </div>

      {!collapsed && (
        <Portal>
          <div
            id="local-cards-panel"
            className="fixed inset-0 z-40 flex justify-end"
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={onToggle}
              className="fixed inset-0 bg-background/50 backdrop-blur-xs transition-opacity"
              aria-hidden="true"
            />

            {/* Slide-in Sheet */}
            <motion.aside
              initial={reduceMotion ? false : { x: "100%", opacity: 0.7 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              className="relative z-50 flex h-full w-full max-w-sm sm:max-w-md flex-col border-l border-border/80 bg-card/95 backdrop-blur-2xl shadow-2xl"
            >
              <LocalCards onClose={onToggle} />
            </motion.aside>
          </div>
        </Portal>
      )}
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
      <Badge variant="accent" className="tabular-nums font-mono">
        <CircleDot className="h-3 w-3 text-primary" aria-hidden="true" />
        {counts.issue} issues
      </Badge>
      <Badge variant="accent" className="tabular-nums font-mono">
        <GitPullRequest className="h-3 w-3 text-primary" aria-hidden="true" />
        {counts.pull} PRs
      </Badge>
      {counts.local > 0 && (
        <Badge variant="primary" className="tabular-nums font-mono">
          {counts.local} local
        </Badge>
      )}
    </div>
  );
}
