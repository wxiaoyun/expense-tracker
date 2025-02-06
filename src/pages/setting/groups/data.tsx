import { toastError, toastSuccess } from "@/components/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch, SwitchControl, SwitchThumb } from "@/components/ui/switch";
import { recurringTransactions, transactions } from "@/db";
import { confirmationCallback } from "@/libs/dialog";
import {
  exportCsv,
  exportDatabase,
  importCsv,
  importDatabase,
} from "@/libs/fs";
import { invalidateRecurringTransactionsQueries } from "@/query/recurring-transactions";
import { invalidateTransactionQueries } from "@/query/transactions";
import { useBackupInterval, useLastBackup } from "@/signals/setting";
import { backupDataIfShouldBackup } from "@/utils/backup";
import {
  FaSolidDownload,
  FaSolidFileCsv,
  FaSolidTrash,
  FaSolidUpload,
} from "solid-icons/fa";
import { createEffect, createMemo, Show } from "solid-js";
import { SettingGroup } from "../components/group";

export const DataGroup = () => {
  return (
    <SettingGroup title="Data">
      <div class="flex flex-col gap-4">
        <ExportData />
        <ImportData />
        <Separator />
        <ExportCsv />
        <ImportCsv />
        <AppendCsv />
        <Separator />
        <PeriodicBackup />
        <Separator />
        <ClearTransactionsData />
      </div>
    </SettingGroup>
  );
};

export const ExportData = () => {
  const handleExport = async () => exportDatabase(toastSuccess, toastError);

  return (
    <div class="flex justify-between items-center">
      <label>Export database</label>

      <FaSolidDownload
        size={24}
        class="cursor-pointer hover:opacity-65 transition-opacity"
        onClick={handleExport}
      />
    </div>
  );
};

export const ImportData = () => {
  const handleImport = confirmationCallback(
    "This action will overwrite all transactions data.",
    {
      title: "Are you sure?",
      okLabel: "Import",
      cancelLabel: "Cancel",
      onConfirm: () =>
        importDatabase((msg) => {
          toastSuccess(msg);
          invalidateTransactionQueries();
        }, toastError),
    },
  );

  return (
    <div class="flex justify-between items-center">
      <label>Import database</label>
      <FaSolidUpload
        size={24}
        class="cursor-pointer hover:opacity-65 transition-opacity"
        onClick={handleImport}
      />
    </div>
  );
};

export const ExportCsv = () => {
  const handleExportCsv = async () => exportCsv(toastSuccess, toastError);

  return (
    <div class="flex justify-between items-center">
      <label>Export as CSV</label>

      <FaSolidFileCsv
        size={24}
        class="cursor-pointer hover:opacity-65 transition-opacity"
        onClick={handleExportCsv}
      />
    </div>
  );
};

export const ImportCsv = () => {
  const handleImportCsv = confirmationCallback(
    "This action will overwrite all transactions data.",
    {
      title: "Are you sure?",
      okLabel: "Import",
      cancelLabel: "Cancel",
      onConfirm: () =>
        importCsv(
          true,
          (msg) => {
            toastSuccess(msg);
            invalidateTransactionQueries();
          },
          toastError,
        ),
    },
  );

  return (
    <div class="flex justify-between items-center">
      <label>Import CSV data</label>

      <FaSolidFileCsv
        size={24}
        class="cursor-pointer hover:opacity-65 transition-opacity"
        onClick={handleImportCsv}
      />
    </div>
  );
};

export const AppendCsv = () => {
  const handleAppendCsv = async () =>
    importCsv(
      false,
      (msg) => {
        toastSuccess(msg);
        invalidateTransactionQueries();
      },
      toastError,
    );

  return (
    <div class="flex justify-between items-center">
      <label>Append CSV data</label>

      <FaSolidFileCsv
        size={24}
        class="cursor-pointer hover:opacity-65 transition-opacity"
        onClick={handleAppendCsv}
      />
    </div>
  );
};

export const ClearTransactionsData = () => {
  const clearTransactionsData = async () => {
    await transactions.clear();
    await recurringTransactions.clear();
    invalidateTransactionQueries();
    invalidateRecurringTransactionsQueries();
  };

  const onClick = confirmationCallback(
    "This action will clear all transactions data.",
    {
      title: "Are you sure?",
      okLabel: "Clear",
      cancelLabel: "Cancel",
      onConfirm: clearTransactionsData,
    },
  );

  return (
    <div class="flex justify-between items-center">
      <label>Clear transactions data</label>

      <FaSolidTrash
        size={24}
        class="text-red-500 hover:text-red-600 transition-colors cursor-pointer"
        onClick={onClick}
      />
    </div>
  );
};

export const PeriodicBackup = () => {
  const [backupInterval, setBackupInterval] = useBackupInterval();
  const [lastBackup] = useLastBackup();

  const backupEnabled = createMemo(() => backupInterval() !== "off");
  const setBackupEnabled = (checked: boolean) => {
    if (checked) {
      setBackupInterval("monthly");
    } else {
      setBackupInterval("off");
    }
  };

  const lastBackupDate = createMemo(() => {
    if (!lastBackup()) return "Never";
    return new Date(lastBackup()).toLocaleString();
  });

  createEffect(() => {
    backupInterval(); // subscribe to backup interval changes
    backupDataIfShouldBackup();
  });

  return (
    <>
      <div class="flex justify-between items-center">
        <label>Periodic backup</label>
        <Switch
          checked={backupEnabled()}
          onChange={(checked) => setBackupEnabled(checked)}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </div>

      <Show when={backupEnabled()}>
        <div class="flex justify-between items-center">
          <label>Backup Interval</label>
          <Select
            value={backupInterval()}
            onChange={(val) => val && setBackupInterval(val)}
            options={BACKUP_INTERVAL_OPTIONS}
            itemComponent={(props) => (
              <SelectItem item={props.item}>{props.item.rawValue}</SelectItem>
            )}
          >
            <SelectTrigger class="w-32 py-1 h-fit">
              <SelectValue<string>>
                {(state) => state.selectedOption()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </div>
      </Show>

      <div class="flex justify-between items-center text-sm text-muted-foreground">
        <label>Last Backup</label>
        <span>{lastBackupDate()}</span>
      </div>
    </>
  );
};
