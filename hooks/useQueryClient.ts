import { useQueryClient } from '@tanstack/react-query';

export const useInvalidateTransactions = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['transactions'] });
};
