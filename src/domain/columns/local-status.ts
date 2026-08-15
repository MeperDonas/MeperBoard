import { COLUMN, type ColumnStrategy } from "./strategy";

/** Local card status values, mapped to columns by `localStatusStrategy`. */
export type LocalStatus = "todo" | "doing" | "done";

/** Maps a local card's `todo`/`doing`/`done` status to its column. */
export const localStatusStrategy: ColumnStrategy<LocalStatus> = {
  key: "local-status",

  columnFor(status) {
    switch (status) {
      case "doing":
        return COLUMN.doing;
      case "done":
        return COLUMN.done;
      case "todo":
      default:
        return COLUMN.todo;
    }
  },
};
