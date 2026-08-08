/**
 * Currency formatting utility - uses Intl.NumberFormat for locale-aware formatting
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(absAmount);
  return amount < 0 ? `-${formatted}` : formatted;
};
