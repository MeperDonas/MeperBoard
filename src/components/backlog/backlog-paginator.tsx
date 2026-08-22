import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../../lib/pagination";
import { Select } from "../ui/select";

export interface BacklogPaginatorProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const pagerButtonClassName =
  "rounded-lg border bg-card p-1.5 text-muted-foreground shadow-xs transition-colors duration-150 hover:border-foreground/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-muted-foreground";

/**
 * Pagination footer: Prev / "Page N of M" / Next plus a page-size selector.
 */
export function BacklogPaginator({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: BacklogPaginatorProps) {
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(totalItems, page * pageSize);

  return (
    <nav
      data-testid="backlog-pager"
      aria-label="Backlog pagination"
      className="mt-3 flex items-center justify-between gap-3"
    >
      <p className="text-xs tabular-nums text-muted-foreground">
        Showing {first}–{last} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            title="Previous page"
            className={pagerButtonClassName}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span
            aria-live="polite"
            className="min-w-20 px-1 text-center text-xs tabular-nums text-muted-foreground"
          >
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            title="Next page"
            className={pagerButtonClassName}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <Select
          aria-label="Rows per page"
          size="sm"
          options={PAGE_SIZE_OPTIONS.map((size) => ({
            value: String(size),
            label: `${size} / page`,
          }))}
          value={String(pageSize)}
          onValueChange={(next) => onPageSizeChange(Number(next))}
          className="w-28"
        />
      </div>
    </nav>
  );
}
