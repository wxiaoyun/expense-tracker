import { toastError, toastSuccess } from "./components/toast";
import { initDb } from "./db";
import { readClipboardAndExecuteCmd } from "./libs/clipboard";
import { invalidateRecurringTransactionsQueries } from "./query/recurring-transactions";
import { invalidateTransactionQueries } from "./query/transactions";
import { backupDataIfShouldBackup } from "./utils/backup";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

export const init = async () => {
  const res = await Promise.allSettled([initDb()]);

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
  backupDataIfShouldBackup();
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
    invalidateTransactionQueries();
    invalidateRecurringTransactionsQueries();
    toastSuccess(res.data);
  }
};
