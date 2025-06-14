import { DATABASE_FILENAME } from "@/constants";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";
import * as schema from "./schema";

// For backward compatibility, export a synchronous db instance
// Note: This should be used carefully and preferably after getDB() has been called
const expo = SQLite.openDatabaseSync(DATABASE_FILENAME, {
  enableChangeListener: true,
})

export let db = drizzle(expo!, { schema });

