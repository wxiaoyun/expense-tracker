import { toastError, toastSuccess } from "./components/toast";
import { initDb } from "./db";
import { readClipboardAndExecuteCmd } from "./libs/clipboard";
import { initializePaths } from "./libs/fs";
import { queryClient } from "./query";
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "./query/recurring-transactions";
import { TRANSACTIONS_QUERY_KEY } from "./query/transactions";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

export const init = async () => {
  const res = await Promise.allSettled([initDb(), initializePaths()]);

  if (res.some((r) => r.status === "rejected")) {
    console.error(
      "[Init] Failed to initialize paths or incur due recurring transactions",
    );
    throw new Error("Failed to initialize app");
  }

  console.info("[Init] App initialized");

  // These can run async
  incurDueRecurringTransactions();
  readClipboardAndExec();
};

const readClipboardAndExec = async () => {
  const res = await readClipboardAndExecuteCmd();

  if (!res.ok) {
    console.error(
      "[Init] Failed to read clipboard and execute command: %s",
      res.err,
    );
    toastError(res.err);
    return;
  }

  console.info("[Init] Read clipboard and executed command: %o", res.data);
  if (res.data) {
    toastSuccess(res.data);

    queryClient.invalidateQueries({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
    });
    queryClient.invalidateQueries({
      queryKey: [TRANSACTIONS_QUERY_KEY],
    });
  }
};
