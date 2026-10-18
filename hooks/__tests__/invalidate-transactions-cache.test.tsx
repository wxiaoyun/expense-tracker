import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import {
  type QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";

import { appQueryClient, reinitializeAppRuntime } from "@/libs/app-runtime";
import { useInvalidateTransactionsAndTemplates } from "../useQueryClient";
import { queryKeys } from "../useTransactionsQuery";

jest.mock("@/db/template", () => ({}));
jest.mock("@/db/transaction", () => ({}));
jest.mock("@/libs/preferences", () => ({
  suggestionLookbackAtom: jest.requireActual("jotai").atom("3m"),
  loadPreferences: jest.fn(),
  resetPreferencesToDefaults: jest.fn(),
  preferenceStore: {},
}));

let client: QueryClient;
let unsubscribe: (() => void)[];

beforeEach(() => {
  client = appQueryClient;
  client.setDefaultOptions({
    queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
    mutations: { gcTime: Infinity },
  });
  unsubscribe = [];
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(async () => {
  await cleanup();
  unsubscribe.forEach((stop) => stop());
  client.clear();
  jest.restoreAllMocks();
  jest.resetAllMocks();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

it.each([false, true])(
  "refetches active transaction and dependent caches before resolving (after restore/reset: %s)",
  async (afterRestore) => {
    let transactionIds: string[] = [];

    const keys = [
      queryKeys.transactions.list({}),
      queryKeys.transactions.list({ categories: ["Coffee"] }),
      queryKeys.transactions.summary({ granularity: "day" }),
      queryKeys.templates.list({}),
      queryKeys.templates.list({ type: "manual" }),
      queryKeys.templates.suggestions("3m"),
      queryKeys.categories.transactionList(),
      queryKeys.categories.templateList(),
    ];
    for (const queryKey of keys) {
      const options = { queryKey, queryFn: async () => [...transactionIds] };
      await client.fetchQuery(options);
      unsubscribe.push(new QueryObserver(client, options).subscribe(() => {}));
    }
    const inactiveKey = queryKeys.transactions.summary({
      granularity: "month",
    });
    await client.fetchQuery({
      queryKey: inactiveKey,
      queryFn: async () => [...transactionIds],
    });
    if (afterRestore) await reinitializeAppRuntime();

    const { result } = await renderHook(useInvalidateTransactionsAndTemplates, {
      wrapper,
    });
    transactionIds = ["transaction-1"];
    await act(async () => {
      await result.current();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    for (const queryKey of keys) {
      expect({ queryKey, data: client.getQueryData(queryKey) }).toEqual({
        queryKey,
        data: transactionIds,
      });
    }
    expect(client.getQueryState(inactiveKey)?.isInvalidated).toBe(true);
    expect(
      await client.fetchQuery({
        queryKey: inactiveKey,
        queryFn: async () => [...transactionIds],
      }),
    ).toEqual(transactionIds);
  },
);
