import { toastError, toastSuccess } from "@/components/toast";
import { recurringTransactions, transactions } from "@/db";
import { confirmationCallback } from "@/libs/dialog";
import { queryClient } from "@/query";
import { RECURRING_TRANSACTIONS_QUERY_KEY } from "@/query/recurring-transactions";
import { TRANSACTIONS_QUERY_KEY } from "@/query/transactions";
import { exportDatabase, importDatabase } from "@/libs/fs";
import { FaSolidDownload, FaSolidTrash, FaSolidUpload } from "solid-icons/fa";
import { SettingGroup } from "../components/group";

export const DataGroup = () => {
  return (
    <SettingGroup title="Data">
      <div class="flex flex-col gap-4">
        <ExportData />
        <ImportData />
        <ClearTransactionsData />
      </div>
    </SettingGroup>
  );
};

export const ExportData = () => {
  const handleExport = async () => exportDatabase(toastSuccess, toastError);

  return (
    <div class="flex justify-between items-center">
      <label>Export data</label>

      <FaSolidDownload
        class="w-4 h-4 hover:opacity-65 transition-opacity cursor-pointer"
        onClick={handleExport}
      />
    </div>
  );
};

export const ImportData = () => {
  const handleImport = async () => importDatabase(toastSuccess, toastError);

  return (
    <div class="flex justify-between items-center">
      <label>Import data</label>
      <FaSolidUpload
        class="w-4 h-4 hover:opacity-65 transition-opacity cursor-pointer"
        onClick={handleImport}
      />
    </div>
  );
};

export const ClearTransactionsData = () => {
  const clearTransactionsData = async () => {
    await transactions.clear();
    await recurringTransactions.clear();
    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
    queryClient.invalidateQueries({
      queryKey: [RECURRING_TRANSACTIONS_QUERY_KEY],
    });
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
        class="w-4 h-4 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
        onClick={onClick}
      />
    </div>
  );
};
