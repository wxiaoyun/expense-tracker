import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listTransactions, summarizeByCategory, summarizeByMonth, summarizeTransactions } from '@/db/transaction';
import type { TemplateListFilter } from '@/db/template';
import type { SuggestionLookback } from '@/db/template-core';

export type TransactionOrderKey = 'transactionDate' | 'amount' | 'category' | 'description' | 'createdAt' | 'updatedAt';
export type TransactionOrderDirection = 'ASC' | 'DESC';

export type TransactionListFilter = {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  orderBy?: [TransactionOrderKey, TransactionOrderDirection];
  categories?: string[];
  verified?: number;
  search?: string;
};

export type TransactionSummaryFilter = Pick<TransactionListFilter, 'start' | 'end' | 'categories' | 'verified'>;

export const queryKeys = {
  transactions: {
    all: () => ['transactions'] as const,
    list: (filter: TransactionListFilter) => ['transactions', 'list', filter] as const,
    summary: (filter: TransactionSummaryFilter) => ['transactions', 'summary', filter] as const,
  },
  templates: {
    all: () => ['templates'] as const,
    list: (filter: TemplateListFilter = {}) => ['templates', 'list', filter] as const,
    detail: (id: string) => ['templates', 'detail', id] as const,
    suggestions: (lookback: SuggestionLookback) => ['templates', 'suggestions', lookback] as const,
  },
  categories: {
    all: () => ['categories'] as const,
    list: () => ['categories', 'list'] as const,
  },
};

export const useInfiniteTransactionListQuery = (filter: TransactionListFilter) => {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filter),
    queryFn: async ({ pageParam = 0 }) => {
      return listTransactions({
        start: filter.start,
        end: filter.end,
        limit: filter.limit ?? 50,
        offset: pageParam,
        orderBy: filter.orderBy ?? ['transactionDate', 'DESC'],
        categories: filter.categories,
        verified: filter.verified,
        search: filter.search,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionSummary = (filter: TransactionSummaryFilter) => {
  return useQuery({
    queryKey: queryKeys.transactions.summary(filter),
    queryFn: async () => {
      const [summary, byCategory, byMonth] = await Promise.all([
        summarizeTransactions({ start: filter.start, end: filter.end, categories: filter.categories, verified: filter.verified }),
        summarizeByCategory({ start: filter.start, end: filter.end, categories: filter.categories }),
        summarizeByMonth({ start: filter.start, end: filter.end, categories: filter.categories }),
      ]);
      return { summary, byCategory, byMonth };
    },
  });
};
