import {
  getRecurringTransaction,
  listCategories as listRecurringCategories,
  listRecurringTransactions,
  listTransactionsByRecurringTransactionId,
} from "@/db/recurring";
import {
  getTransaction,
  listCategories,
  listTransactions,
  summarizeByCategory,
  summarizeTransactions,
} from "@/db/transaction";
import { QueryClient, useInfiniteQuery, useQuery } from "@tanstack/react-query";

export const queryClient = new QueryClient();

// Query Keys - centralized for better cache management
export const TRANSACTIONS_QUERY_KEY = "transactions";
export const CATEGORIES_QUERY_KEY = "categories";
export const INFINITE_TRANSACTIONS_QUERY_KEY = "infinite";
export const TRANSACTIONS_SUMMARIZE_QUERY_KEY = "summarize";
export const RECURRING_TRANSACTIONS_QUERY_KEY = "recurring-transactions";
export const INCURRED_QUERY_KEY = "incurred";

// Global invalidation function for backward compatibility
export const invalidateTransactionQueries = () => {
  queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
};

// Transaction list query
export const useTransactionListQuery = (
  params: Parameters<typeof listTransactions>[0] = {},
) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, params],
    queryFn: async () => {
      const result = await listTransactions(params);
      return result.items;
    },
  });
};

// Infinite transaction list query
export const useInfiniteTransactionListQuery = (
  params: Parameters<typeof listTransactions>[0] = {},
) => {
  return useInfiniteQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, INFINITE_TRANSACTIONS_QUERY_KEY, params],
    queryFn: async ({ pageParam = 0 }) => {
      return listTransactions({
        ...params,
        offset: pageParam,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });
};

// Single transaction query
export const useTransactionQuery = (id: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, id],
    queryFn: async () => getTransaction(id),
    enabled: enabled && !!id,
  });
};

// Transaction categories query
export const useTransactionCategoriesQuery = () => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
    queryFn: async () => listCategories(),
  });
};

// Transaction summarize query
export const useTransactionSummarizeQuery = (
  params: Parameters<typeof summarizeTransactions>[0],
) => {
  return useQuery({
    queryKey: [
      TRANSACTIONS_QUERY_KEY,
      TRANSACTIONS_SUMMARIZE_QUERY_KEY,
      params,
    ],
    queryFn: async () => summarizeTransactions(params),
  });
};

// Transaction summarize by category query
export const useTransactionSummarizeByCategoryQuery = (params: {
  start: Date;
  end: Date;
}) => {
  return useQuery({
    queryKey: [
      TRANSACTIONS_QUERY_KEY,
      TRANSACTIONS_SUMMARIZE_QUERY_KEY,
      CATEGORIES_QUERY_KEY,
      params,
    ],
    queryFn: async () => summarizeByCategory(params),
  });
};

// Query Keys - centralized for better cache management

// Global invalidation function for backward compatibility
export const invalidateRecurringTransactionsQueries = () => {
  queryClient.invalidateQueries({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
  });
};

// Recurring transaction list query
export const useRecurringTransactionListQuery = (
  params: Parameters<typeof listRecurringTransactions>[0] = {},
) => {
  return useQuery({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, params],
    queryFn: async () => listRecurringTransactions(params),
  });
};

// Single recurring transaction query
export const useRecurringTransactionQuery = (
  id: number,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, id],
    queryFn: async () => getRecurringTransaction(id),
    enabled: enabled && !!id,
  });
};

// Incurred recurring transaction list query (transactions created from a recurring transaction)
export const useIncurredRecurringTransactionListQuery = (
  id: number,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, INCURRED_QUERY_KEY, id],
    queryFn: async () => listTransactionsByRecurringTransactionId(id),
    enabled: enabled && !!id,
  });
};

// Recurring transaction categories query
export const useRecurringTransactionCategoriesQuery = () => {
  return useQuery({
    queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY, CATEGORIES_QUERY_KEY],
    queryFn: async () => listRecurringCategories(),
  });
};
