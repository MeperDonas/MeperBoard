import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { BacklogGroupKey } from "../../domain/grouping";
import type { CardType, SortDirection, SortField } from "../../state";
import { Input } from "../ui/input";
import { Select } from "../ui/select";

export type TypeFilter = CardType | "all";

export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "issue", label: "Issues" },
  { value: "pull", label: "Pull requests" },
  { value: "local", label: "Local" },
];

export const SORT_FIELD_OPTIONS: { value: SortField; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
];

export const GROUP_OPTIONS: { value: BacklogGroupKey; label: string }[] = [
  { value: "none", label: "None" },
  { value: "type", label: "Type" },
  { value: "state", label: "State" },
  { value: "source", label: "Source" },
];

export const ALL_LABELS = "all";

export interface BacklogToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (type: TypeFilter) => void;
  labelFilter: string;
  onLabelFilterChange: (label: string) => void;
  labelOptions: { value: string; label: string }[];
  groupBy: BacklogGroupKey;
  onGroupByChange: (group: BacklogGroupKey) => void;
  sortField: SortField;
  onSortFieldChange: (field: SortField) => void;
  sortDir: SortDirection;
  onToggleSortDir: () => void;
}

export function BacklogToolbar({
  searchInput,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  labelFilter,
  onLabelFilterChange,
  labelOptions,
  groupBy,
  onGroupByChange,
  sortField,
  onSortFieldChange,
  sortDir,
  onToggleSortDir,
}: BacklogToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Search</span>
        <span className="relative inline-flex w-full items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            variant="search"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Filter by title…"
          />
        </span>
      </label>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Type</span>
        <Select
          aria-label="Type"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onValueChange={(next) => onTypeFilterChange(next as TypeFilter)}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Label</span>
        <Select
          aria-label="Label"
          options={labelOptions}
          value={labelFilter}
          onValueChange={onLabelFilterChange}
          className="w-44"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Group by</span>
        <Select
          aria-label="Group by"
          options={GROUP_OPTIONS}
          value={groupBy}
          onValueChange={(next) => onGroupByChange(next as BacklogGroupKey)}
          className="w-32"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
        <span>Sort by</span>
        <Select
          aria-label="Sort by"
          options={SORT_FIELD_OPTIONS}
          value={sortField}
          onValueChange={(next) => onSortFieldChange(next as SortField)}
          className="w-28"
        />
      </div>

      <button
        type="button"
        onClick={onToggleSortDir}
        aria-label="Toggle sort direction"
        aria-pressed={sortDir === "desc"}
        title={`Sort ${sortField} ${sortDir === "asc" ? "ascending" : "descending"}. Click to reverse.`}
        className="rounded-lg border bg-card p-2 text-foreground shadow-xs transition-colors duration-150 hover:bg-muted"
      >
        {sortDir === "asc" ? (
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
