import {
  Toast,
  ToastContent,
  ToastDescription,
  ToastProgress,
  ToastTitle,
} from "@/components/ui/toast";
import { DATABASE_FILENAME } from "@/constants";
import { db, reloadDb } from "@/db";
import { validateDatabase } from "@/db/validate";
import { toaster } from "@kobalte/core";
import * as path from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { create, readFile } from "@tauri-apps/plugin-fs";
import { FaSolidDownload, FaSolidUpload } from "solid-icons/fa";
import { Group } from "../components/group";

export const DataGroup = () => {
  return (
    <Group title="Data">
      <div class="flex flex-col gap-4">
        <ExportData />
        <ImportData />
      </div>
    </Group>
  );
};

const ExportData = () => {
  const handleExport = async () => {
    const downloadDir = await path.downloadDir();
    const suggestedDownloadPath = await path.join(
      downloadDir,
      "backup_" + DATABASE_FILENAME,
    );
    const downloadPath = await save({
      title: "Export Data",
      defaultPath: suggestedDownloadPath,
      canCreateDirectories: true,
    });

    console.info("[UI][ExportData] downloadPath: %s", downloadPath);

    if (!downloadPath) {
      console.info("[UI][ExportData] User cancelled the dialog");
      return;
    }

    const appDataDir = await path.appDataDir();
    const dbPath = await path.join(appDataDir, DATABASE_FILENAME);
    const appData = await readFile(dbPath);
    const downloadFile = await create(downloadPath);
    await downloadFile
      .write(appData)
      .then(() => {
        console.info("[UI][ExportData] Data exported successfully");
        toaster.show((props) => (
          <Toast {...props}>
            <ToastContent>
              <ToastTitle>Success</ToastTitle>
              <ToastDescription>Data exported successfully</ToastDescription>
            </ToastContent>
            <ToastProgress />
          </Toast>
        ));
      })
      .catch((error) => {
        console.error("[UI][ExportData] Failed to export data", error);
        toaster.show((props) => (
          <Toast {...props}>
            <ToastContent>
              <ToastTitle>Error</ToastTitle>
              <ToastDescription>Failed to export data</ToastDescription>
            </ToastContent>
            <ToastProgress />
          </Toast>
        ));
      })
      .finally(() => {
        downloadFile.close();
      });
  };

  return (
    <div class="flex justify-between items-center text-sm">
      <label>Export data</label>

      <FaSolidDownload
        class="w-4 h-4 hover:opacity-65 transition-opacity cursor-pointer"
        onClick={handleExport}
      />
    </div>
  );
};

const ImportData = () => {
  const handleImport = async () => {
    try {
      const file = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "SQLite Database",
            extensions: ["db"],
          },
        ],
      });

      if (!file) {
        console.info("[UI][ImportData] User cancelled import dialog");
        return;
      }

      const isValid = await validateDatabase(file);

      if (!isValid) {
        console.info("[UI][ImportData] Invalid database file format");
        toaster.show((props) => (
          <Toast {...props}>
            <ToastContent>
              <ToastTitle>Error</ToastTitle>
              <ToastDescription>
                Invalid database file format. Please ensure you're importing a
                valid backup.
              </ToastDescription>
            </ToastContent>
            <ToastProgress />
          </Toast>
        ));
        return;
      }

      await db.close();
      const fileData = await readFile(file);
      const appDataDir = await path.appDataDir();
      const dbPath = await path.join(appDataDir, DATABASE_FILENAME);

      const dbFile = await create(dbPath);
      await dbFile.write(fileData);
      await dbFile.close();
      await reloadDb();

      console.info("[UI][ImportData] Data imported successfully");
      toaster.show((props) => (
        <Toast {...props}>
          <ToastContent>
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>Data imported successfully</ToastDescription>
          </ToastContent>
          <ToastProgress />
        </Toast>
      )); 
    } catch (error) {
      console.error("[UI][ImportData] Failed to import data", error);
      toaster.show((props) => (
        <Toast {...props}>
          <ToastContent>
            <ToastTitle>Error</ToastTitle>
            <ToastDescription>Failed to import data</ToastDescription>
          </ToastContent>
          <ToastProgress />
        </Toast>
      ));

      await reloadDb();
    }
  };

  return (
    <div class="flex justify-between items-center text-sm">
      <label>Import data</label>
      <FaSolidUpload
        class="w-4 h-4 hover:opacity-65 transition-opacity cursor-pointer"
        onClick={handleImport}
      />
    </div>
  );
};
