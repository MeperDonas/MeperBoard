import { COLUMN, type ColumnStrategy } from "./strategy";

/** Local card status values, mapped to columns by `localStatusStrategy`. */
export type LocalStatus = "backlog" | "todo" | "in-progress" | "doing" | "in-review" | "done";

/** Maps a local card's status to its column. */
export const localStatusStrategy: ColumnStrategy<LocalStatus> = {
  key: "local-status",

  columnFor(status) {
    switch (status) {
      case "backlog":
        return COLUMN.backlog;
      case "in-progress":
      case "doing":
        return COLUMN.inProgress;
      case "in-review":
        return COLUMN.inReview;
      case "done":
        return COLUMN.done;
      case "todo":
      default:
        return COLUMN.todo;
    }
  },
};
