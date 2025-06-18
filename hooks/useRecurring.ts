import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { toast } from "sonner-native";

import { BACKUP_INTERVAL_MAP } from "@/constants";
import {
  incurRecurringTransaction,
  listRecurringTransactions,
} from "@/db/recurring";
import { invalidateTransactionQueries } from "@/hooks/useQuery";
import { backupDatabase, cleanupOldBackups } from "@/libs/fs";
import { Storage } from "expo-sqlite/kv-store";
import { backupIntervalKey, lastBackupKey } from "./useKv";

/**
 * Hook to automatically incur all recurring transactions on app launch
 * This runs once when the app starts and processes all recurring transactions
 * that have pending transactions to create based on their cron schedules
 */
export const useRecurringTransactionIncur = (enabled: boolean) => {
  const lock = useRef(false);

  useEffect(() => {
    if (lock.current || !enabled) return;
    lock.current = true;

    console.log(
      "[useRecurringTransactionIncur] Starting automatic incurring process...",
    );

    // Run the incurring process
    incurAllRecurringTransactions();

    return () => {
      lock.current = false;
    };
  }, [enabled]);
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
  const lock = useRef(false);

  useEffect(() => {
    if (lock.current) return;
    lock.current = true;

    console.log("[usePeriodicBackup] Starting periodic backup");
    performPeriodicBackup();

    return () => {
      lock.current = false;
    };
  }, []);
};

const performPeriodicBackup = async () => {
  try {
    const backupInterval = await Storage.getItemAsync(backupIntervalKey);
    if (!backupInterval || backupInterval === "off") {
      console.log("[usePeriodicBackup] Backup interval is off", backupInterval);
      return;
    }

    const lastBackup = await Storage.getItemAsync(lastBackupKey);
    let lastBackupNum = Number(lastBackup);
    if (isNaN(lastBackupNum)) {
      console.log(
        "[usePeriodicBackup] Last backup is not a number",
        lastBackup,
      );

      await Storage.setItemAsync(lastBackupKey, "0");
      lastBackupNum = 0;
    }

    const lastBackupDate = new Date(lastBackupNum * 1000);
    const now = new Date();

    const diffTime = Math.abs(now.getTime() - lastBackupDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const intervalDays =
      BACKUP_INTERVAL_MAP[backupInterval as keyof typeof BACKUP_INTERVAL_MAP];

    if (diffDays < intervalDays) {
      console.log(
        `[usePeriodicBackup] Last backup was ${diffDays} days ago, skipping backup`,
      );
      return;
    }

    // Perform backup using the new Result-based approach
    const backupResult = await backupDatabase();

    if (backupResult.ok) {
      console.log("[usePeriodicBackup] Backup success:", backupResult.data);
      toast.success("Automatic backup completed");

      // Update last backup timestamp
      await Storage.setItemAsync(
        lastBackupKey,
        Math.floor(Date.now() / 1000).toString(),
      );

      // Clean up old backups (keep last 5)
      const cleanupResult = await cleanupOldBackups(5);
      if (!cleanupResult.ok) {
        console.error("[usePeriodicBackup] Cleanup failed:", cleanupResult.err);
      }
    } else {
      console.error("[usePeriodicBackup] Backup error:", backupResult.err);
      Alert.alert("Backup Error", backupResult.err);
    }
  } catch (error) {
    console.error("[usePeriodicBackup] Error during backup:", error);
    Alert.alert("Backup Error", "Failed to perform automatic backup");
  }
};
