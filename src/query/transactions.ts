import transactions from "@/db/transactions";
import { createQuery } from "@tanstack/solid-query";

export type DateRange = "daily" | "weekly" | "monthly" | "yearly";

export const useTransactionQuery = (getter: () => { start: Date; end: Date }) => {
  return createQuery(() => ({
    queryKey: ["transactions", getter()],
    queryFn: async () => transactions.list(getter()),
  }));
};
