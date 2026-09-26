jest.mock("@/db/transaction", () => ({}));

import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "../useTransactionsQuery";

it("keeps transaction and template category results in separate cache entries", async () => {
  const client = new QueryClient();
  await client.fetchQuery({
    queryKey: queryKeys.categories.transactionList(),
    queryFn: () => ["Transaction category"],
  });
  await client.fetchQuery({
    queryKey: queryKeys.categories.templateList(),
    queryFn: () => ["Template category"],
  });

  expect(client.getQueryData(queryKeys.categories.transactionList())).toEqual([
    "Transaction category",
  ]);
  expect(client.getQueryData(queryKeys.categories.templateList())).toEqual([
    "Template category",
  ]);
  client.clear();
});
