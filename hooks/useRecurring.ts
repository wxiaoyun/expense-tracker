import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner-native";

import { BACKUP_INTERVAL_MAP } from "@/constants";
import {
  incurRecurringTransaction,
  listRecurringTransactions,
} from "@/db/recurring";
import { invalidateTransactionQueries } from "@/hooks/useQuery";
import { backupDatabase, cleanupOldBackups } from "@/libs/fs";
import { Alert } from "react-native";
import { useBackupInterval, useLastBackup } from "./useKv";

/**
 * Hook to automatically incur all recurring transactions on app launch
 * This runs once when the app starts and processes all recurring transactions
 * that have pending transactions to create based on their cron schedules
 */
export const useRecurringTransactionIncur = () => {
  useEffect(() => {
    console.log(
      "[useRecurringTransactionIncur] Starting automatic incurring process...",
    );

    // Run the incurring process
    incurAllRecurringTransactions();
  }, []); // Empty dependency array means this runs once on mount
};

const incurAllRecurringTransactions = async () => {
  try {
    // Get all recurring transactions
    const recurringTransactions = await listRecurringTransactions();

    if (recurringTransactions.length === 0) {
      console.log(
        "[useRecurringTransactionIncur] No recurring transactions found",
      );
      return;
    }

    console.log(
      `[useRecurringTransactionIncur] Found ${recurringTransactions.length} recurring transactions`,
    );

    let totalIncurred = 0;
    const results = [];

    // Process each recurring transaction
    for (const rt of recurringTransactions) {
      try {
        const incurredCount = await incurRecurringTransaction(rt.id);

        if (incurredCount !== null && incurredCount > 0) {
          totalIncurred += incurredCount;
          results.push({
            id: rt.id,
            description: rt.description,
            incurred: incurredCount,
          });
          console.log(
            `[useRecurringTransactionIncur] Incurred ${incurredCount} transactions for "${rt.description}"`,
          );
        }
      } catch (error) {
        console.error(
          `[useRecurringTransactionIncur] Failed to incur recurring transaction ${rt.id}:`,
          error,
        );
      }
    }

    if (totalIncurred > 0) {
      console.log(
        `[useRecurringTransactionIncur] Successfully incurred ${totalIncurred} total transactions`,
      );

      // Invalidate transaction queries to refresh the UI
      invalidateTransactionQueries();

      // Log summary
      results.forEach(({ description, incurred }) => {
        console.log(
          `[useRecurringTransactionIncur] - ${description}: ${incurred} transaction${
            incurred === 1 ? "" : "s"
          }`,
        );
      });

      toast.success(`Incurred ${totalIncurred} transactions`);
    } else {
      console.log(
        "[useRecurringTransactionIncur] No new transactions to incur",
      );
    }
  } catch (error) {
    console.error(
      "[useRecurringTransactionIncur] Error during automatic incurring:",
      error,
    );
    toast.error("Error during automatic incurring");
  }
};

export const usePeriodicBackup = () => {
  const [interval] = useBackupInterval();
  const [lastBackup, setLastBackup] = useLastBackup();
  const lock = useRef(false);

  const shouldBackup = useMemo(() => {
    if (interval === "off") return false;
    if (!lastBackup) return true;

    const now = new Date();
    const lastBackupDate = new Date(lastBackup * 1000);

    const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Get the number of days from the interval map
    const intervalDays =
      BACKUP_INTERVAL_MAP[interval as keyof typeof BACKUP_INTERVAL_MAP];
    return diffDays >= intervalDays;
  }, [interval, lastBackup]);

  useEffect(() => {
    if (lock.current) return;
    lock.current = true;

    if (shouldBackup) {

      console.log("[usePeriodicBackup] Starting automatic backup...");
      performBackup(
        () => {
          setLastBackup(Math.floor(Date.now() / 1000));
        },
        (errMsg) => {
          Alert.alert("Error", errMsg);
        },
      );
    }
    return () => {
      lock.current = false;
    };
  }, [shouldBackup, setLastBackup]);
};

const performBackup = async (
  onSuccess: () => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const success = await backupDatabase(
      (msg) => {
        console.log("[usePeriodicBackup] Backup success:", msg);
        toast.success("Automatic backup completed");
      },
      (errMsg) => {
        console.error("[usePeriodicBackup] Backup error:", errMsg);
        toast.error("Automatic backup failed");
      },
    );

    if (success) {
      // Clean up old backups (keep last 5)
      await cleanupOldBackups(5);
      // Update last backup timestamp
      onSuccess();
    } else {
      onError("Failed to backup data");
    }
  } catch (error) {
    console.error("[usePeriodicBackup] Error during backup:", error);
    onError("Failed to backup data");
  }
};
