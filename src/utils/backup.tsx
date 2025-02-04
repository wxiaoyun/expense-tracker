import { toastError, toastSuccess } from "@/components/toast";
import { settings } from "@/db";
import { backupDatabase } from "@/libs/fs";
import { invalidateSettingsQuery } from "@/query/settings";

const shouldBackup = async () => {
  const backupInterval = await settings.get(
    BACKUP_INTERVAL_SETTING_KEY,
    DEFAULT_BACKUP_INTERVAL,
  );
  const lastBackup = await settings.get(LAST_BACKUP_SETTING_KEY, "0");
  const lastBackupNumber = Number(lastBackup || "0");

  if (backupInterval === "off") return false;
  if (!lastBackupNumber) return true;

  const lastBackupDate = new Date(lastBackupNumber);
  const now = new Date();
  const diffDays =
    (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);

  switch (backupInterval) {
    case "daily":
      return diffDays >= 1;
    case "weekly":
      return diffDays >= 7;
    case "monthly":
      return diffDays >= 30;
    default:
      return false;
  }
};

export const backupDataIfShouldBackup = async () => {
  const shouldBackupNow = await shouldBackup();
  console.info(
    "[Backup] shouldBackupNow: %s",
    shouldBackupNow,
  );
  if (!shouldBackupNow) return;

  await backupDatabase(toastSuccess, toastError);
  settings.set(LAST_BACKUP_SETTING_KEY, new Date().getTime().toString());
  invalidateSettingsQuery();
  console.info("[Backup] Backup completed");
};
