import React from "react";
import { Alert } from "react-native";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";

import {
  legacyDbExists,
  markMigrationComplete,
  runMigrationWithRecovery,
} from "@/db/migration";
import { queryKeys } from "@/hooks/useTransactionsQuery";
import MigrationScreen from "../migrate";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args) },
}));
jest.mock("@/db", () => ({ db: {}, sqlite: {} }));
jest.mock("@/db/transaction", () => ({}));
jest.mock("@/db/migration", () => ({
  legacyDbExists: jest.fn(),
  getLegacyCounts: jest.fn(async () => ({ transactions: 1, recurring: 0 })),
  seedPresetCategories: jest.fn(async () => {}),
  markMigrationComplete: jest.fn(),
  runMigrationWithRecovery: jest.fn(),
}));
jest.mock("@/hooks/useThemeColor", () => ({ useThemeColors: () => ({}) }));
jest.mock("@/components/glass/GlassView", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));

it.each(["initialize", "import", "skip"])(
  "%s refreshes mounted queries and marks inactive caches stale before continuing",
  async (action) => {
    let version = 0;
    const client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, gcTime: Infinity, retry: false },
      },
    });
    const activeKey = queryKeys.transactions.list({});
    const options = { queryKey: activeKey, queryFn: async () => version };
    await client.fetchQuery(options);
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => {});
    const inactiveKeys = [
      queryKeys.transactions.summary({ granularity: "day" }),
      queryKeys.templates.list({}),
      queryKeys.categories.transactionList(),
      queryKeys.categories.templateList(),
    ];
    for (const queryKey of inactiveKeys) {
      await client.fetchQuery({ queryKey, queryFn: async () => version });
    }
    jest.mocked(legacyDbExists).mockReturnValue(action !== "initialize");
    jest.mocked(markMigrationComplete).mockImplementation(async () => {
      version = 1;
    });
    jest.mocked(runMigrationWithRecovery).mockImplementation(async () => {
      version = 1;
      return { success: true, transactionsMigrated: 1, recurringMigrated: 0 };
    });
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const info = jest.spyOn(console, "info").mockImplementation(() => {});

    try {
      const screen = await render(
        <QueryClientProvider client={client}>
          <MigrationScreen />
        </QueryClientProvider>,
      );
      if (action === "import") {
        await waitFor(() => expect(screen.getByText("Import")).toBeTruthy());
        await fireEvent.press(screen.getByText("Import"));
        await waitFor(() => expect(screen.getByText("Continue")).toBeTruthy());
      } else if (action === "skip") {
        await waitFor(() => expect(screen.getByText("Skip")).toBeTruthy());
        await fireEvent.press(screen.getByText("Skip"));
        const confirm = alert.mock.calls[0][2]?.find(
          (button) => button.text === "Skip",
        );
        expect(confirm).toBeDefined();
        await act(async () => {
          await confirm?.onPress?.();
        });
      } else {
        await waitFor(() =>
          expect(mockReplace).toHaveBeenCalledWith("/(tabs)"),
        );
      }

      expect(observer.getCurrentResult().data).toBe(1);
      for (const queryKey of inactiveKeys) {
        expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
        expect(
          await client.fetchQuery({ queryKey, queryFn: async () => version }),
        ).toBe(1);
      }
    } finally {
      await cleanup();
      unsubscribe();
      client.clear();
      alert.mockRestore();
      info.mockRestore();
      jest.clearAllMocks();
    }
  },
);
