"use client";

import { AppHeader } from "../app-header/app-header";
import { Backlog } from "../backlog";

/** The backlog page composition: app header + the filterable/sortable backlog. */
export function BacklogPage() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <Backlog />
    </div>
  );
}
