import transactions from "@/db/transactions";
import { createQuery } from "@tanstack/solid-query";
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
    }),
    () => queryClient,
  );
};

export const createTransactionQuery = (id: () => number) => {
  return createQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, id()],
      queryFn: async () => transactions.get(id()),
    }),
    () => queryClient,
  );
};

export const createTransactionCategoriesQuery = () => {
  return createQuery(
    () => ({
      queryKey: [TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
      queryFn: async () => transactions.categories(),
    }),
    () => queryClient,
  );
};
