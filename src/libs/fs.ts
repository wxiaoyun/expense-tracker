import { db, reloadDb } from "@/db";
import { validateDatabase } from "@/db/validate";
import * as path from "@tauri-apps/api/path";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  create,
  readFile,
  remove,
  watch,
  WatchEvent,
} from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";

// https://tauri.app/plugin/file-system/

let dbPath: string = "";
let appDataDir: string = "";
let downloadDir: string = "";

export const initializePaths = async () => {
  const [appDataDirRes, downloadDirRes] = await Promise.allSettled([
    path.appDataDir(),
    path.downloadDir(),
  ]);

  if (
    appDataDirRes.status === "rejected" ||
    downloadDirRes.status === "rejected"
  ) {
    console.error(
      "[FS][initializePaths] Failed to get app data dir or download dir",
    );
    throw new Error("Failed to get app data dir or download dir");
  }

  appDataDir = appDataDirRes.value;
  downloadDir = downloadDirRes.value;

  dbPath = await path.join(appDataDir, DATABASE_FILENAME);
};

export const getDbPath = () => dbPath;
export const getAppDir = () => appDataDir;
export const getDownloadDir = () => downloadDir;

export const importDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const file = await open({
      title: "Import Data",
      multiple: false,
      directory: false,
      defaultPath: getDownloadDir(),
    });

    if (!file) {
      console.info("[FS][importDatabase] User cancelled import dialog");
      return;
    }

    // Create a temp db in app dir for validation
    // on iOS we cannot read load db directly from download dir
    const tmpDbName = `temp_${nanoid()}.db`;
    const tmpDbPath = await path.join(getAppDir(), tmpDbName);
    const dbData = await readFile(file);
    const tmpDb = await create(tmpDbPath);
    await tmpDb.write(dbData);
    await tmpDb.close();

    const isValid = await validateDatabase(tmpDbPath);
    await remove(tmpDbPath);

    if (!isValid) {
      console.info("[FS][importDatabase] Invalid database file format");
      onError(
        "Invalid database file format. Please ensure you're importing a valid backup.",
      );
      return;
    }

    await db.close();

    const dbPath = getDbPath();
    const dbFile = await create(dbPath);
    await dbFile.write(dbData);
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
    const suggestedDownloadPath = await path.join(
      getDownloadDir(),
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

    const dbPath = getDbPath();
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

export const watchDb = async (cb: (event: WatchEvent) => void) => {
  const unwatch = await watch(getDbPath(), cb, {
    recursive: false,
    delayMs: 1000,
  });

  console.info("[FS][watchDb] Watching db at %s", dbPath);
  return unwatch;
};
