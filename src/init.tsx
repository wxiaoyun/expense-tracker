import { initializePaths } from "./libs/fs";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

export const init = async () => {
  const res = await Promise.allSettled([
    initializePaths(),
    incurDueRecurringTransactions(),
  ]);

  if (res.every((r) => r.status === "fulfilled")) {
    console.info("[APP] App initialized");
    return;
  }

  console.error(
    "[APP] Failed to initialize paths or incur due recurring transactions",
  );
  throw new Error("Failed to initialize app");
};
