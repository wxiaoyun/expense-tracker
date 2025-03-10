import { db, reloadDb, transactions } from "@/db";
import { validateDatabase } from "@/db/validate";
import { appDataDir, BaseDirectory, join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { nanoid } from "nanoid";
import {
  generateCsvContent,
  generateCsvContentFromDb,
  parseCsvContent,
} from "./csv";

// https://tauri.app/plugin/file-system/

const createExportDirIfNotExists = async () => {
  const exportDirExists = await exists(EXPORT_DIR, {
    baseDir: BaseDirectory.Document,
  });
  console.info(
    "[FS][createExportDirIfNotExists] exportDirExists: %s",
    exportDirExists,
  );

  if (!exportDirExists) {
    await mkdir(EXPORT_DIR, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    console.info("[FS][createExportDirIfNotExists] export dir created");
  }

  return EXPORT_DIR;
};

/**
 * Get the path to the export directory, recursively creating the directory if it doesn't exist
 */
const getExportPath = async (fileName: string) => {
  await createExportDirIfNotExists();
  return join(EXPORT_DIR, fileName);
};

const createBackupDirIfNotExists = async () => {
  const backupDirExists = await exists(BACKUP_DIR, {
    baseDir: BaseDirectory.Document,
  });

  if (!backupDirExists) {
    await mkdir(BACKUP_DIR, {
      baseDir: BaseDirectory.Document,
      recursive: true,
    });
    console.info("[FS][createBackupDirIfNotExists] backup dir created");
  }
  return BACKUP_DIR;
};

const getBackupPath = async (fileName: string) => {
  await createBackupDirIfNotExists();
  return join(BACKUP_DIR, fileName);
};

export const importDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const file = await open({
      title: "Import Data",
      multiple: false,
      directory: false,
    });

    if (!file) {
      console.info("[FS][importDatabase] User cancelled import dialog");
      return;
    }

    if (!file.endsWith(".db")) {
      console.info("[FS][importDatabase] Invalid database file format");
      onError(
        "Invalid database file format. Please ensure you're importing a valid backup.",
      );
      return;
    }

    // Create a temp db in app dir for validation
    // on iOS we cannot read load db directly from download dir
    const tmpDbName = `${nanoid()}.db`;
    await copyFile(file, tmpDbName, {
      toPathBaseDir: BaseDirectory.AppData,
    });

    const appDataDirPath = await appDataDir();
    const tmpDbPath = await join(appDataDirPath, tmpDbName);
    const isValid = await validateDatabase(tmpDbPath).finally(() =>
      remove(tmpDbName, {
        baseDir: BaseDirectory.AppData,
      }),
    );

    if (!isValid) {
      console.info("[FS][importDatabase] Invalid database file format");
      onError(
        "Invalid database file format. Please ensure you're importing a valid backup.",
      );
      return;
    }

    await db.close();

    await copyFile(file, DATABASE_FILENAME, {
      toPathBaseDir: BaseDirectory.AppData,
    });

    console.info("[FS][importDatabase] Data imported successfully");
    onSuccess("Data imported successfully");
  } catch (error) {
    console.error("[FS][importDatabase] Failed to import data %o", error);
    onError("Something went wrong, failed to import data");
  } finally {
    await reloadDb();
  }
};

export const exportDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/\s/g, "_");
    const suggestedDownloadName = `${formattedDate}_${DATABASE_FILENAME}`;
    const suggestedDownloadPath = await getExportPath(suggestedDownloadName);

    console.info(
      "[FS][exportDatabase] suggestedDownloadPath: %s",
      suggestedDownloadPath,
    );

    await copyFile(DATABASE_FILENAME, suggestedDownloadPath, {
      fromPathBaseDir: BaseDirectory.AppData,
      toPathBaseDir: BaseDirectory.Document,
    });

    console.info("[FS][exportDatabase] Data exported successfully");
    onSuccess(
      `Data exported successfully, downloaded to ${suggestedDownloadPath}`,
    );
  } catch (error) {
    console.error("[FS][exportDatabase] Failed to export data %o", error);
    onError("Something went wrong, failed to export data");
  }
};

/**
 * @param overwrite - If true, the import will overwrite existing transactions with the same id. Otherwise, it will append to the existing transactions.
 */
export const importCsv = async (
  overwrite: boolean,
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const file = await open({
      title: "Import Data",
      multiple: false,
      directory: false,
    });

    if (!file) {
      console.info("[FS][importDatabase] User cancelled import dialog");
      return;
    }

    if (!file.endsWith(".csv")) {
      console.info("[FS][importCsv] Invalid csv file format");
      onError(
        "Invalid csv file format. Please ensure you're importing a valid csv file.",
      );
      return;
    }

    const csvData = await readTextFile(file);
    const parseResult = parseCsvContent(csvData);

    if (!parseResult.ok) {
      console.error(
        "[FS][importCsv] Failed to parse csv file %o",
        parseResult.err,
      );
      onError(
        "Invalid csv file format. Please ensure you're importing a valid csv file exported from the app.",
      );
      return;
    }

    if (overwrite) {
      await transactions.clear();
    }

    const ok = await transactions.batchCreate(parseResult.data ?? []);
    if (!ok) {
      console.error(
        "[FS][importCsv] Failed to batch create transactions %o",
        ok,
      );
      onError("Something went wrong, failed to batch create transactions");
      return;
    }

    console.info("[FS][importCsv] Data imported successfully");
    onSuccess("Data imported successfully");
  } catch (error) {
    console.error("[FS][importCsv] Failed to import data %o", error);
    onError("Something went wrong, failed to import data");
  }
};

export const exportCsvFromDb = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/\s/g, "_");
    const suggestedDownloadName = `${formattedDate}_${CSV_FILENAME}`;
    const suggestedDownloadPath = await getExportPath(suggestedDownloadName);

    console.info(
      "[FS][exportCsv] suggestedDownloadPath: %s",
      suggestedDownloadPath,
    );

    const csvContentString = await generateCsvContentFromDb();

    await writeTextFile(suggestedDownloadPath, csvContentString, {
      baseDir: BaseDirectory.Document,
    });

    console.info("[FS][exportCsv] Data exported successfully");
    onSuccess(
      `Data exported successfully, downloaded to ${suggestedDownloadPath}`,
    );
  } catch (error) {
    console.error("[FS][exportCsv] Failed to export data %o", error);
    onError("Something went wrong, failed to export data");
  }
};

export const exportCsvFromTransactions = async (
  options: {
    fileName?: string;
  } & Parameters<typeof transactions.list>[0],
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  console.info("[FS][exportCsvFromTransactions] options: %o", options);

  const { fileName = CSV_FILENAME, ...rest } = options;

  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/\s/g, "_");
    const suggestedDownloadName = `${formattedDate}_${fileName}`;
    const suggestedDownloadPath = await getExportPath(suggestedDownloadName);

    console.info(
      "[FS][exportCsvFromTransactions] suggestedDownloadPath: %s",
      suggestedDownloadPath,
    );

    const res = await transactions.list(rest);
    const csvContentString = generateCsvContent(res.items);

    await writeTextFile(suggestedDownloadPath, csvContentString, {
      baseDir: BaseDirectory.Document,
    });

    console.info("[FS][exportCsvFromTransactions] Data exported successfully");
    onSuccess(
      `Data exported successfully, downloaded to ${suggestedDownloadPath}`,
    );
  } catch (error) {
    console.error(
      "[FS][exportCsvFromTransactions] Failed to export data %o",
      error,
    );
    onError("Something went wrong, failed to export data");
  }
};

export const backupDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
) => {
  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/\s/g, "_");
    const backupFileName = `${formattedDate}_${DATABASE_FILENAME}`;
    const backupPath = await getBackupPath(backupFileName);

    await copyFile(DATABASE_FILENAME, backupPath, {
      fromPathBaseDir: BaseDirectory.AppData,
      toPathBaseDir: BaseDirectory.Document,
    });

    console.info("[FS][backupDatabase] Backup created successfully");
    onSuccess("Backup created successfully");
    return true;
  } catch (error) {
    console.error("[FS][backupDatabase] Failed to create backup: %o", error);
    onError("Something went wrong, failed to create backup");
    return false;
  }
};
