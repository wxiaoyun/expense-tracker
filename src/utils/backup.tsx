import { toastError, toastSuccess } from "@/components/toast";
import { backupDatabase } from "@/libs/fs";
import { queryClient } from "@/query";
import { SETTINGS_QUERY_KEY } from "@/query/settings";
import { useBackupInterval, useLastBackup } from "@/signals/setting";

const shouldBackup = async () => {
  const [backupInterval] = useBackupInterval();
  const [lastBackup] = useLastBackup();

  if (backupInterval() === "off") return false;

  if (!lastBackup()) return true;

  const lastBackupDate = new Date(lastBackup());
  const now = new Date();
  const diffDays =
    (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);

  switch (backupInterval()) {
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

export const backupData = async () => {
  const shouldBackupNow = await shouldBackup();

  if (!shouldBackupNow) return;

  const onSuccess = (msg: string) => {
    toastSuccess(msg);
    queryClient.invalidateQueries({
      queryKey: [SETTINGS_QUERY_KEY, LAST_BACKUP_SETTING_KEY],
    });
  };

  await backupDatabase(onSuccess, toastError);
};
