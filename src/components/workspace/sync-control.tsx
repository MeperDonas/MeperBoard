"use client";

import { AlertCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";

import { cn } from "../../lib/utils";
import { useSync } from "../../state/useSync";
import { Button } from "../ui/button";

export interface SyncControlProps {
  /** Optional compact mode for toolbars with limited space */
  compact?: boolean;
  className?: string;
}

export function SyncControl({ compact = false, className }: SyncControlProps) {
  const sync = useSync();

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => sync.mutate()}
        loading={sync.isPending}
        title="Sync issues and pull requests from GitHub"
        aria-label="Sync with GitHub"
        className="shadow-xs hover:border-primary/40 hover:text-primary transition-colors"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5 text-primary", sync.isPending && "animate-spin")}
          aria-hidden="true"
        />
        <span>{sync.isPending ? "Syncing…" : "Sync"}</span>
      </Button>

      {!compact && (
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          data-testid="sync-status"
        >
          {sync.isError ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              <span className="font-medium text-destructive">Sync failed</span>
            </>
          ) : sync.isSuccess ? (
            <>
              <CheckCircle className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              <span className="font-medium text-success">
                Imported {sync.data.imported} item{sync.data.imported === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">GitHub Mirror</span>
            </>
          )}
        </span>
      )}
    </div>
  );
}
