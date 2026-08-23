import { describe, expect, it } from "vitest";
import type { Card } from "../../state/cards";
import { computeProjectMetrics, isCriticalCard } from "./project-metrics";

function mockCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "github:owner/repo:1",
    source: "github",
    type: "issue",
    title: "Sample Issue",
    body: "Description",
    labels: [],
    columnId: "backlog",
    repo: "owner/repo",
    number: 1,
    state: "open",
    htmlUrl: null,
    linkedPrs: [],
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("isCriticalCard", () => {
  it("detects bug, critical, and urgent labels", () => {
    expect(isCriticalCard(mockCard({ labels: ["bug"] }))).toBe(true);
    expect(isCriticalCard(mockCard({ labels: ["CRITICAL-FIX"] }))).toBe(true);
    expect(isCriticalCard(mockCard({ labels: ["urgent", "ui"] }))).toBe(true);
    expect(isCriticalCard(mockCard({ labels: ["p0"] }))).toBe(true);
    expect(isCriticalCard(mockCard({ labels: ["enhancement", "docs"] }))).toBe(false);
  });
});

describe("computeProjectMetrics", () => {
  it("returns zero metrics for empty card set", () => {
    const metrics = computeProjectMetrics([]);
    expect(metrics).toEqual({
      total: 0,
      completed: 0,
      inProgress: 0,
      critical: 0,
      completionPercentage: 0,
      velocityScore: 0,
      totalScore: 0,
    });
  });

  it("calculates completed, in progress, critical, and percentage correctly", () => {
    const cards: Card[] = [
      mockCard({ id: "1", columnId: "done", state: "closed" }),
      mockCard({ id: "2", columnId: "done", state: "closed" }),
      mockCard({ id: "3", columnId: "in-progress", labels: ["bug"] }),
      mockCard({ id: "4", columnId: "in-review", type: "pull" }),
      mockCard({ id: "5", columnId: "todo", labels: ["urgent"] }),
      mockCard({ id: "6", columnId: "backlog" }),
      mockCard({ id: "7", columnId: "backlog" }),
      mockCard({ id: "8", columnId: "backlog" }),
      mockCard({ id: "9", columnId: "backlog" }),
      mockCard({ id: "10", columnId: "backlog" }),
    ];

    const metrics = computeProjectMetrics(cards);
    expect(metrics.total).toBe(10);
    expect(metrics.completed).toBe(2);
    expect(metrics.inProgress).toBe(2); // card 3 (in-progress) + card 4 (in-review)
    expect(metrics.critical).toBe(2); // card 3 (bug) + card 5 (urgent)
    expect(metrics.completionPercentage).toBe(20); // 2/10 = 20%
    expect(metrics.velocityScore).toBeGreaterThan(0);
    expect(metrics.totalScore).toBeGreaterThan(metrics.velocityScore);
  });
});
