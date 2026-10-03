import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import {
  type QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";

import { quickAddTemplate } from "@/db/template";
import { softDeleteTransaction } from "@/db/transaction";
import { appQueryClient, reinitializeAppRuntime } from "@/libs/app-runtime";
import {
  queryKeys,
  useQuickAddTemplateMutation,
  useUndoQuickAddMutation,
} from "../useTemplatesQuery";

jest.mock("@/db/template", () => ({ quickAddTemplate: jest.fn() }));
jest.mock("@/db/transaction", () => ({ softDeleteTransaction: jest.fn() }));
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

it.each([
  ["quick add", false],
  ["undo", false],
  ["quick add", true],
  ["undo", true],
])(
  "%s refetches active transaction and dependent caches before resolving (after restore/reset: %s)",
  async (action, afterRestore) => {
    let transactionIds = action === "undo" ? ["transaction-1"] : [];
    jest.mocked(quickAddTemplate).mockImplementation(async () => {
      transactionIds = ["transaction-1"];
      return { id: "transaction-1" } as Awaited<
        ReturnType<typeof quickAddTemplate>
      >;
    });
    jest.mocked(softDeleteTransaction).mockImplementation(async () => {
      transactionIds = [];
      return true;
    });

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

    const { result } = await renderHook(
      () => ({
        quickAdd: useQuickAddTemplateMutation(),
        undo: useUndoQuickAddMutation(),
      }),
      { wrapper },
    );
    await act(async () => {
      if (action === "quick add") {
        await result.current.quickAdd.mutateAsync("template-1");
      } else {
        await result.current.undo.mutateAsync({
          templateId: "template-1",
          transactionId: "transaction-1",
        });
      }
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

it("does not invalidate caches when Quick Add fails", async () => {
  const queryKey = queryKeys.transactions.list({});
  await client.fetchQuery({ queryKey, queryFn: async () => [] });
  jest.mocked(quickAddTemplate).mockRejectedValue(new Error("Write failed"));
  const { result } = await renderHook(useQuickAddTemplateMutation, { wrapper });

  await act(async () => {
    await expect(result.current.mutateAsync("template-1")).rejects.toThrow(
      "Write failed",
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(client.getQueryState(queryKey)?.isInvalidated).toBe(false);
});
