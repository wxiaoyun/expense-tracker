import { getSystemTheme } from "@/utils/theme";

export const CURRENCY_SETTING_KEY = "currency";
export const CURRENCY_OPTIONS = ["USD", "EUR", "GBP", "CNY", "SGD"];
export const DEFAULT_CURRENCY = "USD";
export const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CNY: "¥",
  SGD: "S$",
} as Record<string, string>;
export const DEFAULT_CURRENCY_SYMBOL = CURRENCY_SYMBOLS[DEFAULT_CURRENCY];

export const THEME_SETTING_KEY = "theme";
export const THEME_OPTIONS = ["system", "light", "dark"];
export const DEFAULT_THEME = getSystemTheme();
