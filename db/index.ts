import { APP_NAME, DATABASE_FILENAME } from "@/constants";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as FileSystem from "expo-file-system";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

// Check for staged database import on startup
const checkStagedImport = async () => {
  const databasePath = `${FileSystem.documentDirectory}${APP_NAME}.db`;
  const stagedDbPath = `${databasePath}.staged`;

  try {
    const stagedInfo = await FileSystem.getInfoAsync(stagedDbPath);
    if (stagedInfo.exists) {
      console.info("[DB] Found staged database import, applying...");

      // Move staged database to active location
      await FileSystem.moveAsync({
        from: stagedDbPath,
        to: databasePath,
      });

      console.info("[DB] Staged database import applied successfully");
      return true;
    }
  } catch (error) {
    console.error("[DB] Error checking staged import:", error);
  }

  return false;
};

// Initialize database with staged import check
const initializeDatabase = async () => {
  const hadStagedImport = await checkStagedImport();

  const expo = SQLite.openDatabaseSync(DATABASE_FILENAME, {
    enableChangeListener: true,
  });

  if (hadStagedImport) {
    console.info("[DB] Database reloaded after staged import");
  }

  return drizzle(expo, { schema });
};

// Type for our database instance
type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

// Initialize the database
let dbPromise: Promise<DatabaseInstance> | null = null;
let dbInstance: DatabaseInstance | null = null;

export const getDB = async (): Promise<DatabaseInstance> => {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }

  dbInstance = await dbPromise;
  return dbInstance;
};

// For backward compatibility, export a synchronous db instance
// Note: This should be used carefully and preferably after getDB() has been called
const expo = SQLite.openDatabaseSync(DATABASE_FILENAME, {
  enableChangeListener: true,
});
export let db = drizzle(expo, { schema });

export const reloadDB = async () => {
  dbInstance = null;
  dbPromise = null;
  const newDb = await getDB();
  db = newDb;
  console.log("[DB] reloaded");
};
