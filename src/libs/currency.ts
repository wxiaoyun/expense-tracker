export const formatCurrency = (
  amount: number,
  options?: {
    currency?: string;
  },
) => {
  const currency = options?.currency || DEFAULT_CURRENCY;

  return new Intl.NumberFormat(navigator.language, {
    style: "currency",
    currency: currency,
  }).format(amount);
};
