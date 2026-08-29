import { getDefaultStore } from 'jotai';
import { currencyAtom } from './preferences';

const NARROW_SYMBOL_OVERRIDES: Record<string, string> = {
  SGD: '$',
};

/**
 * Currency formatting utility - uses Intl.NumberFormat for locale-aware formatting.
 * Hermes can return the ISO code for SGD even when narrowSymbol is requested.
 */
export const formatCurrency = (amount: number, currency?: string): string => {
  const resolvedCurrency = currency ?? getDefaultStore().get(currencyAtom);
  const absAmount = Math.abs(amount);
  const symbolOverride = NARROW_SYMBOL_OVERRIDES[resolvedCurrency];

  if (symbolOverride) {
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
    }).format(absAmount);
    return `${amount < 0 ? '-' : ''}${symbolOverride}${formattedNumber}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: resolvedCurrency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
  }).format(absAmount);
  return amount < 0 ? `-${formatted}` : formatted;
};
