import transactions from "@/db/transactions";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";

export const createTransactionListQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(
    () => ({
      queryKey: ["transactions", params()],
      queryFn: async () => transactions.list(params()),
    }),
    () => queryClient,
  );
};

export const createTransactionQuery = (id: () => number) => {
  return createQuery(
    () => ({
      queryKey: ["transaction", id()],
      queryFn: async () => transactions.get(id()),
    }),
    () => queryClient,
  );
};

export const createTransactionCategoriesQuery = () => {
  return createQuery(
    () => ({ 
      queryKey: ["transaction-categories"], 
      queryFn: async () => transactions.categories() 
    }),
    () => queryClient,
  );
};
