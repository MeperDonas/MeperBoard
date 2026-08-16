import { useQuery } from "@tanstack/react-query";

import {
  filterCards,
  loadCards,
  sortCards,
  type BacklogFilters,
  type BacklogSort,
  type Card,
} from "./cards";
import { queryKeys } from "./query-keys";

/** Flat, filterable, sortable list of every card (github + local). */
export function useBacklog(filters: BacklogFilters = {}, sort?: BacklogSort) {
  return useQuery<Card[]>({
    queryKey: [...queryKeys.backlog, filters, sort],
    queryFn: async () => sortCards(filterCards(await loadCards(), filters), sort),
  });
}
