import { settings } from "@/db";
import { toastError, toastSuccess } from "./components/toast";
import { initDb } from "./db";
import { readClipboardAndExecuteCmd } from "./libs/clipboard";
import { backupDatabase } from "./libs/fs";
import { queryClient } from "./query";
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "./query/recurring-transactions";
import { TRANSACTIONS_QUERY_KEY } from "./query/transactions";
import { incurDueRecurringTransactions } from "./utils/recurring-transactions";

const shouldBackup = async () => {
  const interval = await settings.get(BACKUP_INTERVAL_SETTING_KEY);
  if (!interval?.value || interval.value === 'off') return false;

  const lastBackup = await settings.get(LAST_BACKUP_SETTING_KEY);
  if (!lastBackup?.value) return true;

  const lastBackupDate = new Date(lastBackup.value);
  const now = new Date();
  const diffDays = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);

  switch (interval.value) {
    case 'daily': return diffDays >= 1;
    case 'weekly': return diffDays >= 7;
    case 'monthly': return diffDays >= 30;
    default: return false;
  }
};

const backupData = async () => {
  if (await shouldBackup()) {
    await backupDatabase();
  }
};

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
  backupData();
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
