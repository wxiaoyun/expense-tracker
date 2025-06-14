import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BACKUP_DIR, CSV_FILENAME, DATABASE_FILENAME, EXPORT_DIR } from '@/constants';
import { batchCreateTransactions, clearTransactions, listTransactions } from "@/db/transaction";
import { validateDatabase } from '@/db/validate';
import {
  generateCsvContent,
  generateCsvContentFromDb,
  parseCsvContent,
} from "./csv";

// Define constants


/**
 * Create export directory if it doesn't exist
 */
const createExportDirIfNotExists = async (): Promise<string> => {
  const exportDirPath = `${FileSystem.documentDirectory}${EXPORT_DIR}`;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(exportDirPath);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(exportDirPath, { intermediates: true });
      console.info("[FS][createExportDirIfNotExists] export dir created");
    }
    
    return exportDirPath;
  } catch (error) {
    console.error("[FS][createExportDirIfNotExists] Error creating export directory:", error);
    throw error;
  }
};

/**
 * Get the path to the export directory, creating it if it doesn't exist
 */
const getExportPath = async (fileName: string): Promise<string> => {
  const exportDir = await createExportDirIfNotExists();
  return `${exportDir}/${fileName}`;
};

/**
 * Create backup directory if it doesn't exist
 */
const createBackupDirIfNotExists = async (): Promise<string> => {
  const backupDirPath = `${FileSystem.documentDirectory}${BACKUP_DIR}`;
  
  try {
    const dirInfo = await FileSystem.getInfoAsync(backupDirPath);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(backupDirPath, { intermediates: true });
      console.info("[FS][createBackupDirIfNotExists] backup dir created");
    }
    
    return backupDirPath;
  } catch (error) {
    console.error("[FS][createBackupDirIfNotExists] Error creating backup directory:", error);
    throw error;
  }
};

/**
 * Get the path to the backup directory, creating it if it doesn't exist
 */
const getBackupPath = async (fileName: string): Promise<string> => {
  const backupDir = await createBackupDirIfNotExists();
  return `${backupDir}/${fileName}`;
};

/**
 * Get the database file path
 */
const getDatabasePath = (): string => {
  return `${FileSystem.documentDirectory}${DATABASE_FILENAME}`;
};

/**
 * Check if there's a staged database import waiting
 */
export const hasStagedImport = async (): Promise<boolean> => {
  const databasePath = getDatabasePath();
  const stagedDbPath = `${databasePath}.staged`;
  
  try {
    const stagedInfo = await FileSystem.getInfoAsync(stagedDbPath);
    return stagedInfo.exists;
  } catch (error) {
    console.error("[FS][hasStagedImport] Error checking staged import:", error);
    return false;
  }
};

/**
 * Share a file using the platform's sharing functionality
 * Note: For now, we'll just log the file path since expo-sharing is not installed
 */
const shareFile = async (fileUri: string, filename: string): Promise<void> => {
  try {
    console.info(`[FS][shareFile] File saved to: ${fileUri}`);
    console.info(`[FS][shareFile] Filename: ${filename}`);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, {
        mimeType: filename.endsWith('.csv') ? 'text/csv' : 'application/octet-stream',
        dialogTitle: `Share ${filename}`,
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
      type: '*/*', // Allow all file types, we'll validate the extension
      copyToCacheDirectory: true,
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

    // Create a temp db for validation
    const tmpDbName = `temp_${Date.now()}.db`;
    const tmpDbPath = `${FileSystem.cacheDirectory}${tmpDbName}`;
    
    try {
      // Copy the selected file to a temporary location
      await FileSystem.copyAsync({
        from: file.uri,
        to: tmpDbPath,
      });

      // Validate the database structure and integrity
      console.info("[FS][importDatabase] Validating database structure...");
      const isValid = await validateDatabase(tmpDbPath);
      
      if (!isValid) {
        console.error("[FS][importDatabase] Database validation failed");
        onError(
          "Invalid database file. The file doesn't match the expected database structure or is corrupted."
        );
        return;
      }

      console.info("[FS][importDatabase] Database validation passed");

      // Instead of overwriting the active database, we'll use a staged approach
      const databasePath = getDatabasePath();
      const stagedDbPath = `${databasePath}.staged`;
      
      // Copy to staged location
      await FileSystem.copyAsync({
        from: tmpDbPath,
        to: stagedDbPath,
      });

      console.info("[FS][importDatabase] Database staged for import");
      onSuccess(
        "Database imported and validated successfully. Please restart the app to complete the import process."
      );
      
      // TODO: Implement app restart mechanism or show restart prompt
      
    } finally {
      try {
        await FileSystem.deleteAsync(tmpDbPath, { idempotent: true });
      } catch (cleanupError) {
        console.warn("[FS][importDatabase] Failed to cleanup temp file:", cleanupError);
      }
    }
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
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, "_").split('T')[0];
    const suggestedDownloadName = `${formattedDate}_${DATABASE_FILENAME}`;
    const exportPath = await getExportPath(suggestedDownloadName);

    const databasePath = getDatabasePath();
    
    // Check if database exists
    const dbInfo = await FileSystem.getInfoAsync(databasePath);
    if (!dbInfo.exists) {
      onError("Database file not found");
      return;
    }

    // Copy database to export location
    await FileSystem.copyAsync({
      from: databasePath,
      to: exportPath,
    });

    // Share the exported file
    await shareFile(exportPath, suggestedDownloadName);

    console.info("[FS][exportDatabase] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error("[FS][exportDatabase] Failed to export data:", error);
    onError("Something went wrong, failed to export data");
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
      type: 'text/csv',
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
      console.error("[FS][importCsv] Failed to parse csv file:", parseResult.err);
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
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, "_").split('T')[0];
    const suggestedDownloadName = `${formattedDate}_${CSV_FILENAME}`;
    const exportPath = await getExportPath(suggestedDownloadName);

    console.info("[FS][exportCsvFromDb] exportPath:", exportPath);

    const csvContentString = await generateCsvContentFromDb();

    await FileSystem.writeAsStringAsync(exportPath, csvContentString);

    // Share the exported file
    await shareFile(exportPath, suggestedDownloadName);

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
  options: {
    fileName?: string;
  } & Parameters<typeof listTransactions>[0],
  onSuccess: (msg: string) => void,
  onError: (errMsg: string) => void,
): Promise<void> => {
  console.info("[FS][exportCsvFromTransactions] options:", options);

  const { fileName = CSV_FILENAME, ...rest } = options;

  try {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, "_").split('T')[0];
    const suggestedDownloadName = `${formattedDate}_${fileName}`;
    const exportPath = await getExportPath(suggestedDownloadName);

    console.info("[FS][exportCsvFromTransactions] exportPath:", exportPath);

    const res = await listTransactions(rest);
    const csvContentString = generateCsvContent(res.items);

    await FileSystem.writeAsStringAsync(exportPath, csvContentString);

    // Share the exported file
    await shareFile(exportPath, suggestedDownloadName);

    console.info("[FS][exportCsvFromTransactions] Data exported successfully");
    onSuccess("Data exported successfully");
  } catch (error) {
    console.error("[FS][exportCsvFromTransactions] Failed to export data:", error);
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
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[:.]/g, "_").split('T')[0];
    const backupFileName = `${formattedDate}_${DATABASE_FILENAME}`;
    const backupPath = await getBackupPath(backupFileName);

    const databasePath = getDatabasePath();
    
    // Check if database exists
    const dbInfo = await FileSystem.getInfoAsync(databasePath);
    if (!dbInfo.exists) {
      onError("Database file not found");
      return false;
    }

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
 * Get information about available storage space
 */
export const getStorageInfo = async (): Promise<Result<{
  freeSpace: number;
  totalSpace: number;
}, string>> => {
  try {
    const freeSpace = await FileSystem.getFreeDiskStorageAsync();
    const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
    
    return {
      ok: true,
      data: {
        freeSpace,
        totalSpace,
      },
    };
  } catch (error) {
    console.error("[FS][getStorageInfo] Failed to get storage info:", error);
    return {
      ok: false,
      err: "Failed to get storage information",
    };
  }
};

/**
 * Clean up old backup files (keep only the most recent N backups)
 */
export const cleanupOldBackups = async (keepCount: number = 5): Promise<void> => {
  try {
    const backupDir = await createBackupDirIfNotExists();
    const files = await FileSystem.readDirectoryAsync(backupDir);
    
    // Filter for database backup files and sort by name (which includes timestamp)
    const backupFiles = files
      .filter(file => file.endsWith('.db'))
      .sort()
      .reverse(); // Most recent first

    // Delete old backups beyond the keep count
    const filesToDelete = backupFiles.slice(keepCount);
    
    for (const file of filesToDelete) {
      const filePath = `${backupDir}/${file}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });
      console.info(`[FS][cleanupOldBackups] Deleted old backup: ${file}`);
    }
    
    console.info(`[FS][cleanupOldBackups] Cleanup complete. Kept ${Math.min(backupFiles.length, keepCount)} backups.`);
  } catch (error) {
    console.error("[FS][cleanupOldBackups] Failed to cleanup old backups:", error);
  }
};

/**
 * List all available backup files
 */
export const listBackups = async (): Promise<Result<string[], string>> => {
  try {
    const backupDir = await createBackupDirIfNotExists();
    const files = await FileSystem.readDirectoryAsync(backupDir);
    
    const backupFiles = files
      .filter(file => file.endsWith('.db'))
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
