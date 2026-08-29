import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './useTransactionsQuery';

export const useInvalidateTransactions = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.transactions.all() });
};

export const useInvalidateTemplates = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.templates.all() });
};

export const useInvalidateCategories = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.categories.all() });
};

export const useInvalidateTransactionsAndTemplates = () => {
  const qc = useQueryClient();
  return async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.transactions.all() }),
      qc.invalidateQueries({ queryKey: queryKeys.templates.all() }),
      qc.invalidateQueries({ queryKey: queryKeys.categories.all() }),
    ]);
  };
};
