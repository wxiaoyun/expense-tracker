import recurringTransactions from "@/db/recurring_transactions";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";

export const RECURRING_TRANSACTIONS_QUERY_KEY = "recurring-transactions";
export const INCURRED_QUERY_KEY = "incurred";

export const createRecurringTransactionListQuery = (
  params: () => { start?: Date; end?: Date },
) => {
  return createQuery(
    () => ({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, params()],
      queryFn: async () => recurringTransactions.list(params()),
    }),
    () => queryClient,
  );
};

export const createRecurringTransactionQuery = (id: () => number) => {
  return createQuery(
    () => ({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, id()],
      queryFn: async () => recurringTransactions.get(id()),
    }),
    () => queryClient,
  );
};

export const createIncurredRecurringTransactionListQuery = (
  id: () => number,
) => {
  return createQuery(
    () => ({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, INCURRED_QUERY_KEY, id()],
      queryFn: async () => recurringTransactions.listTransactions(id()),
    }),
    () => queryClient,
  );
};
