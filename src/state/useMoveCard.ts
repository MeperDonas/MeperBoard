import { useMutation, useQueryClient } from "@tanstack/react-query";

import { persistCardMove, resetCardMove, type CardMove } from "./move-card";
import { queryKeys } from "./query-keys";

/**
 * Mutation wrapper over `persistCardMove`. Persisting a move invalidates the
 * board and backlog so the moved card reappears in its new column on the next
 * read. Local cards are also invalidated so their column change is reflected.
 */
export function useMoveCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (move: CardMove) => persistCardMove(move),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.localCards });
    },
  });
}

/** Mutation wrapper to clear manual overrides and restore the item to its natural Git column. */
export function useResetCardMove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cardId: string) => resetCardMove(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.board });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog });
    },
  });
}
