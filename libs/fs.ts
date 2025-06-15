import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import { BACKUP_DIR, DATABASE_PATH, EXPORT_DIR } from "@/constants";
import {
  batchCreateTransactions,
  clearTransactions,
  listTransactions,
} from "@/db/transaction";
import {
  generateCsvContent,
  generateCsvContentFromDb,
  parseCsvContent,
} from "./csv";

/**
 * Share a file using the platform's sharing functionality
 * Note: For now, we'll just log the file path since expo-sharing is not installed
 */
const shareFile = async (fileUri: string): Promise<void> => {
  try {
    console.info(`[FS][shareFile] File saved to: ${fileUri}`);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: fileUri.endsWith(".csv")
          ? "text/csv"
          : "application/octet-stream",
      });
    }
  } catch (error) {
    console.error("[FS][shareFile] Error sharing file:", error);
    throw error;
  }
};

/**
 * Import database from a selected file
 * Note: Since Expo SQLite doesn't support closing connections, we use a restart-based approach
 */
export const importDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*", // Allow all file types, we'll validate the extension
      copyToCacheDirectory: false,
    });

    if (result.canceled) {
      console.info("[FS][importDatabase] User cancelled import dialog");
      return;
    }

    const file = result.assets[0];

    if (!file.name.endsWith(".db")) {
      console.info("[FS][importDatabase] Invalid database file format");
      onError(
        "Invalid database file format. Please ensure you're importing a valid backup.",
      );
      return;
    }

    console.info("[FS][importDatabase] Selected file:", {
      name: file.name,
      uri: file.uri,
      size: file.size,
      mimeType: file.mimeType,
    });

    const fileInfo = await FileSystem.getInfoAsync(file.uri);
    console.info("[FS][importDatabase] File info:", fileInfo);

    if (!fileInfo.exists) {
      console.error("[FS][importDatabase] Selected file does not exist");
      onError(
        "Selected file is not accessible. Please try selecting the file again.",
      );
      return;
    }

    FileSystem.copyAsync({
      from: file.uri,
      to: `${FileSystem.documentDirectory}${DATABASE_PATH}`,
    });

    onSuccess("Database imported successfully, restart the app to see the changes");
  } catch (error) {
    console.error("[FS][importDatabase] Failed to import data:", error);
    onError("Something went wrong, failed to import data");
  }
};

/**
 * Export database to a file and share it
 */
export const exportDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  try {
    const databasePath = `${FileSystem.documentDirectory}${DATABASE_PATH}`;

    // Share the exported file
    await shareFile(databasePath);

    console.info("[FS][exportDatabase] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error("[FS][exportDatabase] Failed to export data:", error);
    onError("Something went wrong, failed to export data");
  }
};

export const purgeDatabase = async (): Promise<void> => {
  try {
    await FileSystem.deleteAsync(
      `${FileSystem.documentDirectory}${DATABASE_PATH}`,
      { idempotent: true },
    );
  } catch (error) {
    console.error("[FS][purgeDatabase] Failed to purge database:", error);
  }
};

/**
 * Import CSV data from a selected file
 * @param overwrite - If true, clears existing transactions before importing
 */
export const importCsv = async (
  overwrite: boolean,
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "text/csv",
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      console.info("[FS][importCsv] User cancelled import dialog");
      return;
    }

    const file = result.assets[0];

    if (!file.name.endsWith(".csv")) {
      console.info("[FS][importCsv] Invalid csv file format");
      onError(
        "Invalid csv file format. Please ensure you're importing a valid csv file.",
      );
      return;
    }

    // Read the CSV file content
    const csvData = await FileSystem.readAsStringAsync(file.uri);
    const parseResult = parseCsvContent(csvData);

    if (!parseResult.ok) {
      console.error(
        "[FS][importCsv] Failed to parse csv file:",
        parseResult.err,
      );
      onError(
        "Invalid csv file format. Please ensure you're importing a valid csv file exported from the app.",
      );
      return;
    }

    if (overwrite) {
      await clearTransactions();
    }

    const success = await batchCreateTransactions(parseResult.data ?? []);
    if (!success) {
      console.error("[FS][importCsv] Failed to batch create transactions");
      onError("Something went wrong, failed to batch create transactions");
      return;
    }

    console.info("[FS][importCsv] Data imported successfully");
    onSuccess("Data imported successfully");
  } catch (error) {
    console.error("[FS][importCsv] Failed to import data:", error);
    onError("Something went wrong, failed to import data");
  }
};

/**
 * Export all transactions from database to CSV and share it
 */
export const exportCsvFromDb = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  try {
    const exportDir = `${FileSystem.documentDirectory}${EXPORT_DIR}`;
    const exportPath = `${exportDir}/export.csv`;
    console.info("[FS][exportCsvFromDb] exportPath:", exportPath);

    const csvContentString = await generateCsvContentFromDb();
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
    await FileSystem.writeAsStringAsync(exportPath, csvContentString);

    // Share the exported file
    await shareFile(exportPath);
    await FileSystem.deleteAsync(exportPath, { idempotent: true });

    console.info("[FS][exportCsvFromDb] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error("[FS][exportCsvFromDb] Failed to export data:", error);
    onError("Something went wrong, failed to export data");
  }
};

/**
 * Export specific transactions to CSV and share it
 */
export const exportCsvFromTransactions = async (
  options: Parameters<typeof listTransactions>[0],
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  console.info("[FS][exportCsvFromTransactions] options:", options);

  try {
    const exportDir = `${FileSystem.documentDirectory}${EXPORT_DIR}`;
    const exportPath = `${exportDir}/export.csv`;

    console.info("[FS][exportCsvFromTransactions] exportPath:", exportPath);

    // Ensure export directory exists
    await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

    const res = await listTransactions(options);
    const csvContentString = generateCsvContent(res.items);

    await FileSystem.writeAsStringAsync(exportPath, csvContentString);

    // Share the exported file
    await shareFile(exportPath);
    await FileSystem.deleteAsync(exportPath, { idempotent: true });

    console.info("[FS][exportCsvFromTransactions] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error(
      "[FS][exportCsvFromTransactions] Failed to export data:",
      error,
    );
    onError("Something went wrong, failed to export data");
  }
};

/**
 * Create a backup of the database
 */
export const backupDatabase = async (
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<boolean> => {
  try {
    const databasePath = `${FileSystem.documentDirectory}${DATABASE_PATH}`;
    console.info("[FS][backupDatabase] databasePath:", databasePath);

    // Check if database exists
    const dbInfo = await FileSystem.getInfoAsync(databasePath);
    if (!dbInfo.exists) {
      onError("Database file not found");
      return false;
    }

    // Ensure backup directory exists
    const backupDir = `${FileSystem.documentDirectory}${BACKUP_DIR}`;
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });

    const backupFilename = `${new Date().toISOString()}.db`;
    const backupPath = `${backupDir}/${backupFilename}`;
    await FileSystem.copyAsync({
      from: databasePath,
      to: backupPath,
    });

    console.info("[FS][backupDatabase] Backup created successfully");
    onSuccess("Backup created successfully");
    return true;
  } catch (error) {
    console.error("[FS][backupDatabase] Failed to create backup:", error);
    onError("Something went wrong, failed to create backup");
    return false;
  }
};

/**
 * Clean up old backup files (keep only the most recent N backups)
 */
export const cleanupOldBackups = async (
  keepCount: number = 5,
): Promise<void> => {
  try {
    const backupDir = `${FileSystem.documentDirectory}${BACKUP_DIR}`;
    const files = await FileSystem.readDirectoryAsync(backupDir);

    // Filter for database backup files and sort by name (which includes timestamp)
    const backupFiles = files
      .filter((file) => file.endsWith(".db"))
      .sort()
      .reverse(); // Most recent first

    // Delete old backups beyond the keep count
    const filesToDelete = backupFiles.slice(keepCount);

    for (const file of filesToDelete) {
      const filePath = `${backupDir}/${file}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.info(`[FS][cleanupOldBackups] Deleted old backup: ${file}`);
    }

    console.info(
      `[FS][cleanupOldBackups] Cleanup complete. Kept ${Math.min(
        backupFiles.length,
        keepCount,
      )} backups.`,
    );
  } catch (error) {
    console.error(
      "[FS][cleanupOldBackups] Failed to cleanup old backups:",
      error,
    );
  }
};

/**
 * List all available backup files
 */
export const listBackups = async (): Promise<Result<string[], string>> => {
  try {
    const backupDir = `${FileSystem.documentDirectory}${BACKUP_DIR}`;
    
    // Ensure backup directory exists
    await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
    
    const files = await FileSystem.readDirectoryAsync(backupDir);

    const backupFiles = files
      .filter((file) => file.endsWith(".db"))
      .sort()
      .reverse(); // Most recent first

    return {
      ok: true,
      data: backupFiles,
    };
  } catch (error) {
    console.error("[FS][listBackups] Failed to list backups:", error);
    return {
      ok: false,
      err: "Failed to list backup files",
    };
  }
};

/**
 * Delete a specific backup file
 */
export const deleteBackup = async (
  filename: string,
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<boolean> => {
  try {
    const backupPath = `${FileSystem.documentDirectory}${BACKUP_DIR}/${filename}`;
    
    // Check if backup file exists
    const fileInfo = await FileSystem.getInfoAsync(backupPath);
    if (!fileInfo.exists) {
      onError("Backup file not found");
      return false;
    }

    await FileSystem.deleteAsync(backupPath, { idempotent: true });

    console.info(`[FS][deleteBackup] Deleted backup: ${filename}`);
    onSuccess("Backup deleted successfully");
    return true;
  } catch (error) {
    console.error("[FS][deleteBackup] Failed to delete backup:", error);
    onError("Something went wrong, failed to delete backup");
    return false;
  }
};
