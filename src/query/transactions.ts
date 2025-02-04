import transactions from "@/db/transactions";
import {
  createInfiniteQuery,
  createQuery,
  keepPreviousData,
} from "@tanstack/solid-query";
import { queryClient } from "./query";

export const TRANSACTIONS_QUERY_KEY = "transactions";
export const CATEGORIES_QUERY_KEY = "categories";
export const INFINITE_TRANSACTIONS_QUERY_KEY = "infinite";
export const TRANSACTIONS_SUMMARIZE_QUERY_KEY = "summarize";

export const invalidateTransactionQueries = () => {
  queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
};

export const createTransactionListQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(() => ({
    queryKey: [TRANSACTIONS_QUERY_KEY, params()],
    queryFn: async () => transactions.list(params()),
    placeholderData: keepPreviousData,
    select: (data) => data.items,
  }));
};

export const createInfiniteTransactionListQuery = (
  params: () => Parameters<typeof transactions.list>[0],
) => {
  return createInfiniteQuery(() => ({
    queryKey: [
      TRANSACTIONS_QUERY_KEY,
      INFINITE_TRANSACTIONS_QUERY_KEY,
      params(),
    ],
    queryFn: async ({ pageParam = 0 }) => {
      return transactions.list({
        ...params(),
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    placeholderData: keepPreviousData,
  }));
};

export const createTransactionQuery = (id: () => number) => {
  return createQuery(() => ({
    queryKey: [TRANSACTIONS_QUERY_KEY, id()],
    queryFn: async () => transactions.get(id()),
    placeholderData: keepPreviousData,
  }));
};

export const createTransactionCategoriesQuery = () => {
  return createQuery(() => ({
    queryKey: [TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
    queryFn: async () => transactions.categories(),
    placeholderData: keepPreviousData,
  }));
};

export const createTransactionSummarizeQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(() => ({
    queryKey: [
      TRANSACTIONS_QUERY_KEY,
      TRANSACTIONS_SUMMARIZE_QUERY_KEY,
      params(),
    ],
    queryFn: async () => transactions.summarize(params()),
    placeholderData: keepPreviousData,
  }));
};

export const createTransactionSummarizeByCategoryQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(() => ({
    queryKey: [
      TRANSACTIONS_QUERY_KEY,
      TRANSACTIONS_SUMMARIZE_QUERY_KEY,
      CATEGORIES_QUERY_KEY,
      params(),
    ],
    queryFn: async () => transactions.summarizeByCategory(params()),
    placeholderData: keepPreviousData,
  }));
};
