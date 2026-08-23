import type { Card } from "../../state/cards";

export interface ProjectMetrics {
  total: number;
  completed: number;
  inProgress: number;
  critical: number;
  completionPercentage: number;
  velocityScore: number;
  totalScore: number;
}

/** Check whether a card carries high-priority, bug, or security labels. */
export function isCriticalCard(card: Pick<Card, "labels">): boolean {
  const criticalPatterns = [
    "bug",
    "critical",
    "urgent",
    "p0",
    "p1",
    "priority: high",
    "high priority",
    "security",
    "blocker",
  ];
  return card.labels.some((label) => {
    const lower = label.toLowerCase();
    return criticalPatterns.some((pattern) => lower.includes(pattern));
  });
}

/**
 * Compute real-time dashboard health metrics across cards.
 *
 * Metrics:
 * - Completed: Cards in `done` column or closed state.
 * - In Progress: Cards in `in-progress` or `in-review`.
 * - Critical: Active cards labeled with bug/urgent/blocker/security tags.
 * - Completion Percentage: Rounded ratio of completed / total.
 * - Velocity & Total Points: Story point weight estimates based on item type and severity.
 */
export function computeProjectMetrics(cards: readonly Card[]): ProjectMetrics {
  const total = cards.length;
  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      critical: 0,
      completionPercentage: 0,
      velocityScore: 0,
      totalScore: 0,
    };
  }

  let completed = 0;
  let inProgress = 0;
  let critical = 0;
  let totalScore = 0;
  let velocityScore = 0;

  for (const card of cards) {
    const isDone = card.columnId === "done" || card.state === "closed";
    const isInProgress =
      card.columnId === "in-progress" ||
      card.columnId === "doing" ||
      card.columnId === "in-review";

    if (isDone) {
      completed++;
    } else if (isInProgress) {
      inProgress++;
    }

    const isCrit = isCriticalCard(card);
    if (isCrit && !isDone) {
      critical++;
    }

    const pts = card.type === "pull" ? 5 : isCrit ? 6 : 3;
    totalScore += pts;
    if (isDone) {
      velocityScore += pts;
    }
  }

  const completionPercentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    critical,
    completionPercentage,
    velocityScore,
    totalScore,
  };
}
