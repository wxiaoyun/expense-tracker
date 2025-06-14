import { getLocales } from "expo-localization";

export const formatCurrency = (
  amount: number,
  options?: {
    currency?: string;
  },
) => {
  let currency = options?.currency;
  if (!currency) {
    const locales = getLocales();
    if (locales.length === 0) {
      return "USD";
    }
    currency = locales[0].currencyCode ?? "USD";
  }

  return new Intl.NumberFormat(navigator.language, {
    style: "currency",
    currency: currency,
  }).format(amount);
};
