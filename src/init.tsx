import { toastError, toastSuccess } from "./components/toast";
import { initDb, settings } from "./db";
import { readClipboardAndExecuteCmd } from "./libs/clipboard";
import { invalidateRecurringTransactionsQueries } from "./query/recurring-transactions";
import { invalidateTransactionQueries } from "./query/transactions";
import { backupDataIfShouldBackup } from "./utils/backup";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

export const init = async () => {
  const res = await Promise.allSettled([initDb()]);

  if (res.some((r) => r.status === "rejected")) {
    console.error(res.filter((r) => r.status === "rejected"));
    throw new Error("Failed to initialize app");
  }

  console.info("[Init] App initialized");

  // These can run async
  incurDueRecurringTransactions();
  readClipboardAndExec();
  backupDataIfShouldBackup();
};

export const onVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    readClipboardAndExec();
  }
};

const readClipboardAndExec = async () => {
  const enabled = Boolean(await settings.get(CLIPBOARD_EXEC_SETTING_KEY));
  if (!enabled) {
    console.info(
      "[Clipboard][readClipboardAndExec] Clipboard exec is disabled",
    );
    return;
  }

  const res = await readClipboardAndExecuteCmd();

  if (!res.ok) {
    console.error(
      "[Clipboard][readClipboardAndExec] Failed to read clipboard and execute command: %s",
      res.err,
    );
    toastError(res.err);
    return;
  }

  console.info(
    "[Clipboard][readClipboardAndExec] Read clipboard and executed command: %o",
    res.data,
  );
  if (res.data) {
    invalidateTransactionQueries();
    invalidateRecurringTransactionsQueries();
    toastSuccess(res.data);
  }
};
