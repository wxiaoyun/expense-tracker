import { transactions } from "@/db";
import { formatCurrency } from "@/libs/currency";
import { createRecurringTransactionCategoriesQuery } from "@/query/recurring-transactions";
import {
  createInfiniteTransactionListQuery,
  createTransactionCategoriesQuery,
  createTransactionSummarizeByCategoryQuery,
} from "@/query/transactions";
import { ChartConfiguration } from "chart.js";
import { createMemo } from "solid-js";
import { useDateRange } from "./params";
import { useCurrency, useResolvedTheme } from "./setting";

export const useTransactionCategories = () => {
  const qt = createTransactionCategoriesQuery();
  const rtq = createRecurringTransactionCategoriesQuery();

  const categories = createMemo(() => {
    const cat = new Set<string>();
    (qt.data ?? []).forEach((category) => cat.add(category.category));
    (rtq.data ?? []).forEach((category) => cat.add(category.category));
    return Array.from(cat);
  });

  return categories;
};

export const useInfiniteTransactions = (
  dependencies?: () => Parameters<typeof transactions.list>[0],
) => {
  return createInfiniteTransactionListQuery(dependencies ?? (() => ({})));
};

export const useTransactionChartConfig = () => {
  const theme = useResolvedTheme();
  const [currency] = useCurrency();
  const { dateRange } = useDateRange();
  const query = createTransactionSummarizeByCategoryQuery(dateRange);

  const cfg = createMemo((): Option<ChartConfiguration<"doughnut">> => {
    const data = query.data;

    if (!data || data.length === 0) {
      return null;
    }

    const labels = data.map((item) => item.category);

    const categoryColors = labels.map(
      (_, i) => DEFAULT_COLOR_SCHEME[i % DEFAULT_COLOR_SCHEME.length],
    );

    const borderColor = theme() === "light" ? "#fefcfd" : "#002642";
    const oppositeColor = theme() !== "light" ? "#fefcfd" : "#002642";

    const datasets = [
      {
        label: "Income",
        data: data.map((item) => Math.max(0, item.income)),
        backgroundColor: categoryColors,
        borderColor,
      },
      {
        label: "Expense",
        data: data.map((item) => Math.abs(item.expense)),
        backgroundColor: categoryColors,
        borderColor,
      },
      {
        label: "Balance",
        data: data.map((item) => Math.abs(item.balance)),
        backgroundColor: categoryColors,
        borderColor,
      },
    ];

    return {
      type: "doughnut",
      data: { labels, datasets },
      options: {
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: {
              color: oppositeColor,
              pointStyle: "circle",
              usePointStyle: true,
            },
          },
          tooltip: {
            position: "nearest",
            callbacks: {
              title: (context) => {
                if (context.length === 0) return undefined;
                return context[0].dataset.label || "";
              },
              label: (context) => {
                const label = context.label || "";
                const value = context.raw as number;
                return `${label}: ${formatCurrency(value, {
                  currency: currency(),
                })}`;
              },
            },
          },
        },
      },
    };
  });

  return cfg;
};
