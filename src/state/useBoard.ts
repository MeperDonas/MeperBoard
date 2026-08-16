import { useQuery } from "@tanstack/react-query";

import { loadBoard, type Board } from "./cards";
import { queryKeys } from "./query-keys";

/** Board projection over the local store — columns + resolved cards. */
export function useBoard() {
  return useQuery<Board>({
    queryKey: queryKeys.board,
    queryFn: loadBoard,
  });
}
