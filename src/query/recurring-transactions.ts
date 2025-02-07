import recurringTransactions from "@/db/recurring_transactions";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";
import { CATEGORIES_QUERY_KEY } from "./transactions";

export const RECURRING_TRANSACTIONS_QUERY_KEY = "recurring-transactions";
export const INCURRED_QUERY_KEY = "incurred";

export const invalidateRecurringTransactionsQueries = () => {
  queryClient.invalidateQueries({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
  });
};

export const createRecurringTransactionListQuery = (
  params: () => Parameters<typeof recurringTransactions.list>[0],
) => {
  return createQuery(() => ({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, params()],
    queryFn: async () => recurringTransactions.list(params()),
  }));
};

export const createRecurringTransactionQuery = (id: () => number) => {
  return createQuery(() => ({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, id()],
    queryFn: async () => recurringTransactions.get(id()),
  }));
};

export const createIncurredRecurringTransactionListQuery = (
  id: () => number,
) => {
  return createQuery(() => ({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, INCURRED_QUERY_KEY, id()],
    queryFn: async () => recurringTransactions.listTransactions(id()),
  }));
};

export const createRecurringTransactionCategoriesQuery = () => {
  return createQuery(() => ({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
    queryFn: async () => recurringTransactions.listCategories(),
  }));
};
