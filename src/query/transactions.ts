import transactions from "@/db/transactions";
import {
  createInfiniteQuery,
  createQuery,
  keepPreviousData,
} from "@tanstack/solid-query";
import { queryClient } from "./query";

export const TRANSACTIONS_QUERY_KEY = "transactions";
export const CATEGORIES_QUERY_KEY = "categories";

export const createTransactionListQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, params()],
      queryFn: async () => transactions.list(params()),
      placeholderData: keepPreviousData,
      select: (data) => data.items,
    }),
    () => queryClient,
  );
};

export const createInfiniteTransactionListQuery = (
  params: () => { start: Date; end: Date; limit?: number } & Record<
    string,
    unknown
  >,
) => {
  return createInfiniteQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, "infinite", params()],
      queryFn: async ({ pageParam = 0 }) => {
        return transactions.list({
          limit: 50,
          ...params(),
          cursor: pageParam,
        });
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
    }),
    () => queryClient,
  );
};

export const createTransactionQuery = (id: () => number) => {
  return createQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, id()],
      queryFn: async () => transactions.get(id()),
      placeholderData: keepPreviousData,
    }),
    () => queryClient,
  );
};

export const createTransactionCategoriesQuery = () => {
  return createQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
      queryFn: async () => transactions.categories(),
      placeholderData: keepPreviousData,
    }),
    () => queryClient,
  );
};
