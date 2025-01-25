import { DATABASE_FILENAME } from "@/constants/db";
import { db, reloadDb } from "@/db";
import { validateDatabase } from "@/db/validate";
import * as path from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import { create, readFile } from "@tauri-apps/plugin-fs";

export const importDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
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
      console.info("[FS][importDatabase] User cancelled import dialog");
      return;
    }

    const isValid = await validateDatabase(file);

    if (!isValid) {
      console.info("[FS][importDatabase] Invalid database file format");
      onError(
        "Invalid database file format. Please ensure you're importing a valid backup.",
      );
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

    console.info("[FS][importDatabase] Data imported successfully");
    onSuccess("Data imported successfully");
  } catch (error) {
    console.error("[FS][importDatabase] Failed to import data %o", error);
    onError("Something went wrong, failed to import data");

    await reloadDb();
  }
};

export const exportDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
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

    if (!downloadPath) {
      console.info("[FS][exportDatabase] User cancelled the dialog");
      return;
    }

    console.info("[FS][exportDatabase] downloadPath: %s", downloadPath);

    const appDataDir = await path.appDataDir();
    const dbPath = await path.join(appDataDir, DATABASE_FILENAME);
    const appData = await readFile(dbPath);
    const downloadFile = await create(downloadPath);

    await downloadFile.write(appData);
    await downloadFile.close();

    console.info("[FS][exportDatabase] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error("[FS][exportDatabase] Failed to export data %o", error);
    onError("Something went wrong, failed to export data");
  }
};
