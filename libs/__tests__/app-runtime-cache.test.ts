import { QueryObserver } from "@tanstack/react-query";

import {
  appQueryClient,
  processLaunchTemplatesOnce,
  reinitializeAppRuntime,
  resetLaunchTemplateProcessing,
} from "../app-runtime";

const mockProcessScheduledTemplates = jest.fn();

jest.mock("@/db/template", () => ({
  processScheduledTemplates: (...args: unknown[]) =>
    mockProcessScheduledTemplates(...args),
}));
jest.mock("@/db/transaction", () => ({}));
jest.mock("@/libs/preferences", () => ({
  loadPreferences: jest.fn(),
  resetPreferencesToDefaults: jest.fn(),
  preferenceStore: {},
}));

describe("runtime query refresh", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockProcessScheduledTemplates.mockResolvedValue([]);
    await resetLaunchTemplateProcessing();
    appQueryClient.clear();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    appQueryClient.clear();
    jest.restoreAllMocks();
  });

  it.each([false, true])(
    "refreshes mounted observers after replacing data (import schedules: %s)",
    async (processImportedSchedules) => {
      let databaseValue = "before replacement";
      const queryKeys = [
        ["transactions", "list", {}],
        ["transactions", "summary", { granularity: "month" }],
        ["templates", "list", {}],
        ["categories", "templates"],
      ];
      const observers = queryKeys.map(
        (queryKey) =>
          new QueryObserver(appQueryClient, {
            queryKey,
            queryFn: async () => databaseValue,
          }),
      );
      const unsubscribe = observers.map((observer) =>
        observer.subscribe(() => undefined),
      );

      try {
        await Promise.all(observers.map((observer) => observer.refetch()));
        databaseValue = "after replacement";

        await reinitializeAppRuntime({ processImportedSchedules });

        for (const observer of observers) {
          expect(observer.getCurrentResult().data).toBe("after replacement");
        }

        databaseValue = "after next mutation";
        await appQueryClient.invalidateQueries();
        for (const observer of observers) {
          expect(observer.getCurrentResult().data).toBe("after next mutation");
        }
      } finally {
        unsubscribe.forEach((stop) => stop());
      }
    },
  );

  it("invalidates both category lists after scheduled transactions are created", async () => {
    const transactionCategories = ["categories", "transactions"];
    const templateCategories = ["categories", "templates"];
    appQueryClient.setQueryData(transactionCategories, ["Old category"]);
    appQueryClient.setQueryData(templateCategories, ["Old category"]);
    mockProcessScheduledTemplates.mockResolvedValue([
      { id: "scheduled-1", incurred: 1 },
    ]);

    await processLaunchTemplatesOnce();

    expect(
      appQueryClient.getQueryState(transactionCategories)?.isInvalidated,
    ).toBe(true);
    expect(
      appQueryClient.getQueryState(templateCategories)?.isInvalidated,
    ).toBe(true);
  });
});
