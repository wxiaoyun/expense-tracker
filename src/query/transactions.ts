import transactions from "@/db/transactions";
import { createQuery } from "@tanstack/solid-query";
import { queryClient } from "./query";

export const createTransactionQuery = (
  params: () => { start: Date; end: Date },
) => {
  return createQuery(
    () => ({
      queryKey: ["transactions", params()],
      queryFn: async () => transactions.list(params()),
    }),
    () => queryClient,
  );
};
