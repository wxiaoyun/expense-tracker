import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listTransactions, summarizeTransactions, summarizeByCategory } from '@/db/transaction';

export const queryKeys = {
  transactions: {
    list: (filter: any) => ['transactions', 'list', filter] as const,
    summary: () => ['transactions', 'summary'] as const,
  },
  recurring: {
    list: () => ['recurring', 'list'] as const,
  },
  categories: {
    list: () => ['categories', 'list'] as const,
  },
};

export const useInfiniteTransactionListQuery = (filter: any) => {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filter),
    queryFn: async ({ pageParam = 0 }) => {
      return listTransactions({
        start: filter.start,
        end: filter.end,
        limit: 50,
        offset: pageParam as any,
        orderBy: ['transactionDate', 'DESC'],
        categories: filter.categories,
        verified: filter.verified,
        search: filter.search,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });
};

export const useTransactionSummary = (filter: any) => {
  return useQuery({
    queryKey: queryKeys.transactions.summary(),
    queryFn: async () => {
      const [summary, byCategory] = await Promise.all([
        summarizeTransactions({ start: filter.start, end: filter.end, categories: filter.categories }),
        summarizeByCategory({ start: filter.start, end: filter.end }),
      ]);
      return { summary, byCategory };
    },
  });
};
