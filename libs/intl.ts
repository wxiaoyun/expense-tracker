import { getDefaultStore } from 'jotai';
import { currencyAtom } from './preferences';

/**
 * Currency formatting utility - uses Intl.NumberFormat for locale-aware formatting
 */
export const formatCurrency = (amount: number, currency?: string): string => {
  const resolvedCurrency = currency ?? getDefaultStore().get(currencyAtom);
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: resolvedCurrency,
    minimumFractionDigits: 2,
  }).format(absAmount);
  return amount < 0 ? `-${formatted}` : formatted;
};
